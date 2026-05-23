'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import * as d3 from 'd3'
import ReactECharts from 'echarts-for-react'
import { Telescope } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { formatCurrencyCompact, formatCurrency } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'universe' | 'cashflow' | 'allocation' | 'timeline'

interface D3Node {
  id: string
  name: string
  type: string
  value: number
  color: string
  emoji: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
}

interface D3Link {
  source: string | D3Node
  target: string | D3Node
  type: string
  value: number
}

interface AllocationItem {
  label: string
  value: number
  pct: number
}

interface HistoryPoint {
  date: string
  assets: number
  liabilities: number
  net_worth: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOC_COLORS = ['#10B981', '#0EA5E9', '#F97316', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

const EDGE_COLORS: Record<string, string> = {
  income_flow: '#22C55E',
  investment:  '#10B981',
  emi:         '#EF4444',
  bill:        '#F97316',
  liability:   '#EF4444',
  asset:       '#8B5CF6',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'universe',  label: '🌌 Universe'  },
  { id: 'cashflow',  label: '💸 Cash Flow' },
  { id: 'allocation',label: '🥧 Allocation' },
  { id: 'timeline',  label: '📈 Timeline'  },
]

// ── Client-side graph builder (same data as Settings Excel export) ──────────────

function buildD3Graph(
  banks: any[],
  cards: any[],
  loans: any[],
  investments: any[],
  assets: any[],
  nwValue: number,
): { nodes: D3Node[]; links: D3Link[] } {
  const nodes: D3Node[] = []
  const links: D3Link[] = []

  // Central Net Worth node
  nodes.push({ id: 'networth', name: 'Net Worth', type: 'networth', value: Math.abs(nwValue), color: nwValue >= 0 ? '#6366F1' : '#EF4444', emoji: '📊' })

  // Bank nodes
  banks.forEach((b, i) => {
    const id = `bank_${i}`
    const bal = Number(b.current_balance ?? 0)
    nodes.push({ id, name: (b.nickname || b.bank_name || 'Bank').slice(0, 16), type: 'bank', value: bal, color: b.account_color || '#0EA5E9', emoji: '🏦' })
    if (bal > 0) links.push({ source: id, target: 'networth', type: 'asset', value: bal })
  })

  // Card nodes
  cards.forEach((c, i) => {
    const id = `card_${i}`
    const out = Number(c.current_outstanding ?? 0)
    const name = `${c.bank_name ?? ''} ···${c.last_four ?? ''}`.trim().slice(0, 16)
    nodes.push({ id, name, type: 'card', value: out, color: '#F97316', emoji: '💳' })
    if (out > 0) links.push({ source: 'networth', target: id, type: 'liability', value: out })
  })

  // Investment nodes — group if too many
  const activeInv = investments.filter((i: any) => Number(i.current_value ?? 0) > 0)
  if (activeInv.length > 0 && activeInv.length <= 6) {
    activeInv.forEach((inv: any, i: number) => {
      const id = `inv_${i}`
      const val = Number(inv.current_value ?? 0)
      nodes.push({ id, name: inv.name.slice(0, 14), type: 'investment', value: val, color: '#10B981', emoji: '📈' })
      if (val > 0) links.push({ source: id, target: 'networth', type: 'investment', value: val })
    })
  } else if (activeInv.length > 6) {
    const total = activeInv.reduce((s: number, i: any) => s + Number(i.current_value ?? 0), 0)
    nodes.push({ id: 'investments', name: 'Investments', type: 'investment', value: total, color: '#10B981', emoji: '📈' })
    if (total > 0) links.push({ source: 'investments', target: 'networth', type: 'investment', value: total })
  }

  // Loan nodes
  loans.forEach((l: any, i: number) => {
    const id = `loan_${i}`
    const out = Number(l.outstanding_balance ?? 0)
    nodes.push({ id, name: (l.nickname || l.lender_name || 'Loan').slice(0, 16), type: 'loan', value: out, color: '#EF4444', emoji: '⚠️' })
    if (out > 0) links.push({ source: 'networth', target: id, type: 'liability', value: out })
  })

  // Asset nodes (significant ones)
  const sigAssets = assets.filter((a: any) => Number(a.current_value ?? 0) > 50000)
  if (sigAssets.length > 0 && sigAssets.length <= 4) {
    sigAssets.forEach((a: any, i: number) => {
      const id = `asset_${i}`
      const val = Number(a.current_value ?? 0)
      nodes.push({ id, name: a.name.slice(0, 16), type: 'asset', value: val, color: '#8B5CF6', emoji: '🏠' })
      if (val > 0) links.push({ source: id, target: 'networth', type: 'asset', value: val })
    })
  } else if (sigAssets.length > 4) {
    const total = sigAssets.reduce((s: number, a: any) => s + Number(a.current_value ?? 0), 0)
    nodes.push({ id: 'assets', name: 'Assets', type: 'asset', value: total, color: '#8B5CF6', emoji: '🏠' })
    if (total > 0) links.push({ source: 'assets', target: 'networth', type: 'asset', value: total })
  }

  return { nodes, links }
}

// ── Client-side Sankey builder ─────────────────────────────────────────────────
// Uses string names for source/target — ECharts Sankey requires this when data uses 'name' keys

function buildSankeyOption(loans: any[], investments: any[], cards: any[]): object | null {
  const emiMonthly = loans.reduce((s: number, l: any) => s + Number(l.emi_amount ?? 0), 0)
  const sipMonthly = investments
    .filter((i: any) => i.is_sip && i.sip_amount)
    .reduce((s: number, i: any) => s + Number(i.sip_amount ?? 0), 0)
  const cardMonthly = cards.reduce((s: number, c: any) => s + Number(c.current_outstanding ?? 0) / 12, 0)

  const totalOut = emiMonthly + sipMonthly + cardMonthly
  if (totalOut === 0) return null

  // Estimate income as 1.3× outflows (fallback when no income source data)
  const income = Math.max(totalOut * 1.3, 10000)
  const savings = Math.max(income - totalOut, 0)

  // Build nodes and links — only for non-zero flows
  const nodeNames: string[] = ['Income']
  const links: { source: string; target: string; value: number }[] = []

  const addFlow = (label: string, value: number) => {
    if (value < 1) return
    nodeNames.push(label)
    links.push({ source: 'Income', target: label, value: Math.round(value) })
  }

  addFlow('Loan EMIs', emiMonthly)
  addFlow('SIP / Investments', sipMonthly)
  addFlow('Card Bills', cardMonthly)
  if (savings > 0) addFlow('Savings', savings)

  if (links.length === 0) return null

  // Deduplicate node names (safety)
  const uniqueNodes = [...new Set(nodeNames)].map(name => ({ name }))

  const nodeColors: Record<string, string> = {
    Income:             '#22C55E',
    'Loan EMIs':        '#EF4444',
    'SIP / Investments':'#10B981',
    'Card Bills':       '#F97316',
    Savings:            '#F59E0B',
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>₹${Number(p.value ?? 0).toLocaleString('en-IN')}`,
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: uniqueNodes.map(n => ({
        name: n.name,
        itemStyle: { color: nodeColors[n.name] ?? '#A09890' },
      })),
      links,
      lineStyle: { color: 'gradient', opacity: 0.4, curveness: 0.5 },
      itemStyle: { borderRadius: 6 },
      label: {
        color: '#1C1410',
        fontFamily: 'system-ui',
        formatter: (p: any) => `${p.name}\n₹${((Number(p.value) ?? 0) / 1000).toFixed(0)}K`,
      },
      nodeWidth: 20,
      nodeGap: 14,
      orient: 'horizontal',
    }],
  }
}

// ── D3 Force Graph ─────────────────────────────────────────────────────────────

function D3ForceGraph({ nodes: rawNodes, links: rawLinks }: { nodes: D3Node[]; links: D3Link[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !rawNodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    const defs = svg.append('defs')
    const f = defs.append('filter').attr('id', 'shadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    f.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 4).attr('flood-color', 'rgba(0,0,0,0.15)')

    const g = svg.append('g')
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on('zoom', e => g.attr('transform', e.transform)))

    const maxVal = d3.max(rawNodes, d => d.value) ?? 1
    const r = d3.scaleSqrt().domain([0, maxVal]).range([18, 54])

    const nodes: D3Node[] = rawNodes.map(d => ({ ...d }))
    const links: D3Link[] = rawLinks.map(d => ({ ...d }))

    const nw = nodes.find(n => n.type === 'networth')
    if (nw) { nw.fx = width / 2; nw.fy = height / 2 }

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>(d => r(d.value) + 22))
    simRef.current = sim

    const linkSel = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => EDGE_COLORS[d.type] ?? '#A09890')
      .attr('stroke-width', d => Math.max(1.5, Math.min(5, (d.value ?? 0) / 8000)))
      .attr('stroke-opacity', 0.35)
      .attr('stroke-dasharray', d => d.type === 'liability' ? '6,3' : null)

    const nodeSel = g.append('g').selectAll<SVGGElement, D3Node>('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); if (d.type !== 'networth') { d.fx = null; d.fy = null } })
      )

    nodeSel.append('circle')
      .attr('r', d => r(d.value))
      .attr('fill', d => d.color)
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .attr('filter', 'url(#shadow)')

    nodeSel.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(13, r(d.value) * 0.58)).text(d => d.emoji)

    nodeSel.append('text').attr('text-anchor', 'middle').attr('y', d => r(d.value) + 14)
      .attr('font-size', 11).attr('font-weight', '600').attr('fill', '#1C1410')
      .text(d => d.name.length > 13 ? d.name.slice(0, 13) + '…' : d.name)

    nodeSel.append('text').attr('text-anchor', 'middle').attr('y', d => r(d.value) + 26)
      .attr('font-size', 10).attr('fill', '#6B6460')
      .text(d => formatCurrencyCompact(d.value))

    const tip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseover', (e, d) => {
        tip.style('opacity', '1')
          .html(`<div style="font-size:20px">${d.emoji}</div><div style="font-weight:700;color:#1C1410">${d.name}</div><div style="color:#F97316;font-weight:600">${formatCurrency(d.value)}</div><div style="font-size:11px;color:#A09890;text-transform:capitalize;margin-top:2px">${d.type}</div>`)
        d3.select(e.currentTarget).select('circle').attr('stroke', '#F97316').attr('stroke-width', 3)
      })
      .on('mousemove', e => {
        const rc = containerRef.current!.getBoundingClientRect()
        tip.style('left', `${e.clientX - rc.left + 12}px`).style('top', `${e.clientY - rc.top - 10}px`)
      })
      .on('mouseout', e => {
        tip.style('opacity', '0')
        d3.select(e.currentTarget).select('circle').attr('stroke', '#fff').attr('stroke-width', 2)
      })

    linkSel
      .on('mouseover', (e, d) => {
        const src = (d.source as D3Node).name ?? String(d.source)
        const tgt = (d.target as D3Node).name ?? String(d.target)
        tip.style('opacity', '1')
          .html(`<div style="font-weight:700;color:#1C1410">${src} → ${tgt}</div><div style="color:#F97316;font-weight:600">${formatCurrencyCompact(d.value)}</div>`)
        d3.select(e.currentTarget).attr('stroke-opacity', 0.9)
      })
      .on('mousemove', e => {
        const rc = containerRef.current!.getBoundingClientRect()
        tip.style('left', `${e.clientX - rc.left + 12}px`).style('top', `${e.clientY - rc.top - 10}px`)
      })
      .on('mouseout', e => {
        tip.style('opacity', '0')
        d3.select(e.currentTarget).attr('stroke-opacity', 0.35)
      })

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as D3Node).x ?? 0).attr('y1', d => (d.source as D3Node).y ?? 0)
        .attr('x2', d => (d.target as D3Node).x ?? 0).attr('y2', d => (d.target as D3Node).y ?? 0)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })
  }, [rawNodes, rawLinks])

  useEffect(() => { draw(); return () => { simRef.current?.stop() } }, [draw])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 500 }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ background: '#FAFAF8', borderRadius: 12 }} />
      <div ref={tooltipRef} style={{
        position: 'absolute', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
        background: 'rgba(255,255,255,0.96)', border: '1px solid #E8E2DA', borderRadius: 10,
        padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 140,
        fontSize: 13, lineHeight: 1.5, zIndex: 50,
      }} />
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function GraphSkeleton() {
  const pts = [{ cx: '50%', cy: '50%', r: 50 }, { cx: '25%', cy: '30%', r: 32 }, { cx: '75%', cy: '30%', r: 32 }, { cx: '20%', cy: '68%', r: 26 }, { cx: '80%', cy: '68%', r: 26 }, { cx: '50%', cy: '20%', r: 22 }]
  return (
    <div style={{ height: 500, background: '#FAFAF8', borderRadius: 12, overflow: 'hidden' }}>
      <svg width="100%" height="100%">
        {pts.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#E8E2DA">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
          </circle>
        ))}
      </svg>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
// Uses the same individual API queries as Settings → Excel export.
// TanStack Query deduplicates — visiting either page first warms the cache for the other.

export function VisualizationView() {
  const [tab, setTab] = useState<Tab>('universe')

  // ── Same queries as Settings Excel export ─────────────────────────────────
  const { data: nwData, isLoading: nwLoading } = useQuery({
    queryKey: ['net-worth'],
    queryFn: async () => (await api.get('/net-worth/current')).data,
  })
  const { data: history = [] } = useQuery<HistoryPoint[]>({
    queryKey: ['net-worth-history'],
    queryFn: async () => (await api.get('/net-worth/history')).data,
  })
  const { data: cardsRaw } = useQuery({
    queryKey: ['cards'],
    queryFn: async () => (await api.get('/cards?page_size=200')).data,
  })
  const { data: loansRaw } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => (await api.get('/loans')).data,
  })
  const { data: invRaw } = useQuery({
    queryKey: ['investments'],
    queryFn: async () => (await api.get('/investments')).data,
  })
  const { data: assetsRaw } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get('/assets')).data,
  })
  const { data: banksRaw } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => (await api.get('/bank-accounts')).data,
  })

  // Normalise list shapes
  const banks       = useMemo(() => (banksRaw?.items ?? banksRaw ?? []) as any[], [banksRaw])
  const cards       = useMemo(() => (cardsRaw?.items ?? cardsRaw ?? []) as any[], [cardsRaw])
  const loans       = useMemo(() => (loansRaw?.items ?? loansRaw ?? []) as any[], [loansRaw])
  const investments = useMemo(() => (Array.isArray(invRaw) ? invRaw : invRaw?.items ?? []) as any[], [invRaw])
  const assets      = useMemo(() => (Array.isArray(assetsRaw) ? assetsRaw : assetsRaw?.items ?? []) as any[], [assetsRaw])

  const nwValue = Number(nwData?.net_worth ?? 0)
  const isLoading = nwLoading

  // ── Build graph data client-side ──────────────────────────────────────────
  const { nodes: d3Nodes, links: d3Links } = useMemo(
    () => buildD3Graph(banks, cards, loans, investments, assets, nwValue),
    [banks, cards, loans, investments, assets, nwValue],
  )

  // ── Build Sankey option client-side (string names, crash-proof) ────────────
  const sankeyOption = useMemo(
    () => buildSankeyOption(loans, investments, cards),
    [loans, investments, cards],
  )

  // ── ECharts: Sunburst ─────────────────────────────────────────────────────
  const getSunburstOption = () => {
    const alloc: AllocationItem[] = nwData?.allocation ?? []
    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p: any) => `${p.name}<br/>${formatCurrency(p.value)}<br/>${p.percent?.toFixed(1) ?? ''}%`,
      },
      series: [{
        type: 'sunburst',
        radius: ['20%', '80%'],
        data: alloc.map((item, i) => ({
          name: item.label,
          value: item.value,
          itemStyle: { color: ALLOC_COLORS[i % ALLOC_COLORS.length] },
        })),
        itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#FBF8F4' },
        label: { rotate: 'radial', minAngle: 8 },
        emphasis: { focus: 'ancestor' },
        levels: [
          {},
          { r0: '20%', r: '55%', label: { align: 'right' }, itemStyle: { borderWidth: 2 } },
          { r0: '55%', r: '80%', label: { position: 'outside', padding: 3 }, itemStyle: { borderWidth: 2 } },
        ],
      }],
    }
  }

  // ── ECharts: Timeline ─────────────────────────────────────────────────────
  const getTimelineOption = () => {
    if (!history.length) return {}
    const dates = history.map(h => h.date)
    const assetVals = history.map(h => h.assets)
    const liabVals  = history.map(h => h.liabilities)
    const nwVals    = history.map(h => h.net_worth)
    const maxNW     = Math.max(...nwVals)
    const maxIdx    = nwVals.indexOf(maxNW)

    const mkSeries = (name: string, data: number[], color: string, extra: object = {}) => ({
      name, type: 'line', data, smooth: true, symbol: 'none',
      lineStyle: { color, width: 2.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '55' }, { offset: 1, color: color + '05' }] } },
      itemStyle: { color },
      ...extra,
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross' },
        formatter: (params: any[]) => `<b>${params[0].axisValue}</b><br/>` + params.map(p => `${p.seriesName}: ${formatCurrencyCompact(p.value)}`).join('<br/>'),
      },
      legend: { top: 0, data: ['Assets', 'Liabilities', 'Net Worth'], textStyle: { color: '#6B6460' } },
      grid: { top: 40, bottom: 60, left: 70, right: 20 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#A09890', fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { color: '#A09890', fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) } },
      dataZoom: [{ type: 'slider', bottom: 4, height: 22, borderColor: '#E8E2DA', fillerColor: 'rgba(249,115,22,0.12)', handleStyle: { color: '#F97316' } }],
      animationDuration: 1500,
      series: [
        mkSeries('Assets', assetVals, '#10B981'),
        mkSeries('Liabilities', liabVals, '#F97316'),
        mkSeries('Net Worth', nwVals, '#7C3AED', {
          markPoint: maxIdx >= 0 ? { data: [{ name: 'Peak', coord: [dates[maxIdx], maxNW], symbol: 'pin', itemStyle: { color: '#7C3AED' } }] } : undefined,
        }),
      ],
    }
  }

  // Cash flow summary
  const totalEMI = loans.reduce((s: number, l: any) => s + Number(l.emi_amount ?? 0), 0)
  const totalSIP = investments.filter((i: any) => i.is_sip && i.sip_amount).reduce((s: number, i: any) => s + Number(i.sip_amount ?? 0), 0)
  const totalCard = cards.reduce((s: number, c: any) => s + Number(c.current_outstanding ?? 0) / 12, 0)
  const totalOut  = totalEMI + totalSIP + totalCard
  const estIncome = totalOut > 0 ? Math.max(totalOut * 1.3, 10000) : 0
  const netFlow   = estIncome - totalOut

  return (
    <div className="flex flex-col h-full" style={{ background: '#FBF8F4' }}>
      <PageHeader
        icon={Telescope}
        title="Financial Universe"
        subtitle="Interactive visualization of your complete financial life"
      />

      {/* Tab bar */}
      <div className="px-4 md:px-6 pt-4 pb-2 flex gap-2 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all"
            style={{
              background: tab === t.id ? '#F97316' : '#fff',
              color:      tab === t.id ? '#fff'    : '#6B6460',
              border:     `1.5px solid ${tab === t.id ? '#F97316' : '#E8E2DA'}`,
              boxShadow:  tab === t.id ? '0 2px 8px rgba(249,115,22,0.28)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <AnimatePresence mode="wait">

          {/* ── Universe ── */}
          {tab === 'universe' && (
            <motion.div key="universe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Financial Relationship Graph</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Drag nodes · Scroll to zoom · Hover for details</p>
                </div>
                <div className="p-3">
                  {isLoading
                    ? <GraphSkeleton />
                    : d3Nodes.length > 0
                      ? <D3ForceGraph nodes={d3Nodes} links={d3Links} />
                      : <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>Add banks, cards, loans or investments to see your financial universe.</div>
                  }
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Cash Flow ── */}
          {tab === 'cashflow' && (
            <motion.div key="cashflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Monthly Cash Flow</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>How money flows through your financial life</p>
                </div>
                <div className="p-4">
                  {sankeyOption
                    ? <ReactECharts key="sankey" option={sankeyOption} notMerge style={{ height: '420px' }} />
                    : <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>Add loans, SIPs or credit cards to see cash flow.</div>
                  }
                </div>
              </div>

              {/* Summary cards */}
              {totalOut > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { label: 'Est. Monthly Income', value: estIncome, color: '#22C55E' },
                    { label: 'Monthly Outflow',     value: totalOut,  color: '#EF4444' },
                    { label: 'Net Flow',             value: netFlow,   color: netFlow >= 0 ? '#22C55E' : '#EF4444' },
                  ].map(s => (
                    <div key={s.label} className="card text-center" style={{ padding: '16px 12px' }}>
                      <div className="text-[11px] font-semibold mb-1" style={{ color: '#A09890' }}>{s.label}</div>
                      <div className="text-[16px] font-extrabold" style={{ color: s.color }}>{formatCurrencyCompact(s.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Allocation ── */}
          {tab === 'allocation' && (
            <motion.div key="allocation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Asset Allocation</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Breakdown of your wealth distribution</p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    {nwData?.allocation?.length
                      ? <ReactECharts key="sunburst" option={getSunburstOption()} notMerge style={{ height: '420px' }} />
                      : <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>No allocation data available.</div>
                    }
                  </div>
                  {nwData?.allocation?.length ? (
                    <div className="md:w-52 flex flex-col gap-1.5 self-center">
                      {(nwData.allocation as AllocationItem[]).map((item, i) => (
                        <div key={item.label} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg" style={{ background: '#FAF7F4' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: ALLOC_COLORS[i % ALLOC_COLORS.length], flexShrink: 0 }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold truncate" style={{ color: '#1C1410' }}>{item.label}</div>
                            <div className="text-[11px]" style={{ color: '#A09890' }}>{formatCurrencyCompact(item.value)}</div>
                          </div>
                          <div className="text-[12px] font-bold" style={{ color: ALLOC_COLORS[i % ALLOC_COLORS.length] }}>
                            {item.pct?.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Timeline ── */}
          {tab === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Net Worth Timeline</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Your wealth journey over time</p>
                </div>
                <div className="p-4">
                  {history.length
                    ? <ReactECharts key="timeline" option={getTimelineOption()} notMerge style={{ height: '420px' }} />
                    : <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>No history data available yet.</div>
                  }
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
