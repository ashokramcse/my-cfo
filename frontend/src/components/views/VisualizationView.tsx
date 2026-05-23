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
  level: 0 | 1 | 2       // 0=networth, 1=category hub, 2=individual item
  hubId?: string          // parent hub id (only level-2 nodes)
  value: number
  color: string
  emoji: string
  x?: number; y?: number; fx?: number | null; fy?: number | null; vx?: number; vy?: number
}

interface D3Link {
  source: string | D3Node
  target: string | D3Node
  type: string
  value: number
}

interface AllocationItem { label: string; value: number; pct: number }
interface HistoryPoint   { date: string; assets: number; liabilities: number; net_worth: number }

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOC_COLORS = ['#10B981','#0EA5E9','#F97316','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899']

const TABS: { id: Tab; label: string }[] = [
  { id: 'universe',   label: '🌌 Universe'   },
  { id: 'cashflow',   label: '💸 Cash Flow'  },
  { id: 'allocation', label: '🥧 Allocation' },
  { id: 'timeline',   label: '📈 Timeline'   },
]

// ── Multi-level graph builder ──────────────────────────────────────────────────
// Level 0: Net Worth  (center)
// Level 1: Category hubs  (inner ring) — Banking, Credit, Loans, Investments, Assets
// Level 2: Individual items (outer ring) — each account/card/loan/etc.

function buildD3Graph(
  banks: any[], cards: any[], loans: any[], investments: any[], assets: any[], nwValue: number,
): { nodes: D3Node[]; links: D3Link[] } {
  const nodes: D3Node[] = []
  const links: D3Link[] = []

  // L0 — central node
  nodes.push({
    id: 'networth', name: 'Net Worth', type: 'networth', level: 0,
    value: Math.abs(nwValue), color: nwValue >= 0 ? '#6366F1' : '#EF4444', emoji: '📊',
  })

  // Helper: add a category hub + its items
  const addHub = (
    hubId: string, hubName: string, hubEmoji: string, hubColor: string,
    items: any[],
    mapFn: (item: any) => { name: string; type: string; value: number; emoji: string; linkType: string },
  ) => {
    const mapped = items.map(mapFn).filter(m => m.value > 0)
    if (!mapped.length) return

    const total = mapped.reduce((s, m) => s + m.value, 0)

    // Hub node (level 1)
    nodes.push({ id: hubId, name: hubName, type: 'hub', level: 1, value: total, color: hubColor, emoji: hubEmoji })
    links.push({ source: hubId, target: 'networth', type: 'hub', value: total })

    // Item nodes (level 2)
    mapped.forEach((m, i) => {
      const id = `${hubId}_${i}`
      nodes.push({ id, name: m.name, type: m.type, level: 2, hubId, value: m.value, color: hubColor, emoji: m.emoji })
      links.push({ source: id, target: hubId, type: m.linkType, value: m.value })
    })
  }

  addHub('hub_banking', 'Banking', '🏦', '#0EA5E9', banks, b => ({
    name: (b.nickname || b.bank_name || 'Bank').slice(0, 15),
    type: 'bank', value: Number(b.current_balance ?? 0), emoji: '🏦', linkType: 'asset',
  }))

  addHub('hub_credit', 'Credit Cards', '💳', '#F97316', cards, c => ({
    name: (`${c.bank_name ?? ''} ···${c.last_four ?? ''}`).trim().slice(0, 15),
    type: 'card', value: Number(c.current_outstanding ?? 0), emoji: '💳', linkType: 'liability',
  }))

  addHub('hub_loans', 'Loans', '⚠️', '#EF4444',
    loans.filter((l: any) => Number(l.outstanding_balance ?? 0) > 0),
    l => ({
      name: (l.nickname || l.lender_name || 'Loan').slice(0, 15),
      type: 'loan', value: Number(l.outstanding_balance ?? 0), emoji: '⚠️', linkType: 'liability',
    })
  )

  addHub('hub_investments', 'Investments', '📈', '#10B981',
    investments.filter((i: any) => Number(i.current_value ?? 0) > 0),
    i => ({
      name: (i.name || 'Investment').slice(0, 15),
      type: 'investment', value: Number(i.current_value ?? 0), emoji: '📈', linkType: 'investment',
    })
  )

  addHub('hub_assets', 'Assets', '🏠', '#8B5CF6',
    assets.filter((a: any) => Number(a.current_value ?? 0) > 10000),
    a => ({
      name: (a.name || 'Asset').slice(0, 15),
      type: 'asset', value: Number(a.current_value ?? 0), emoji: '🏠', linkType: 'asset',
    })
  )

  return { nodes, links }
}

// ── Sankey builder (cash flow, same data, string names) ────────────────────────

function buildSankeyOption(loans: any[], investments: any[], cards: any[]): object | null {
  const emi  = loans.reduce((s: number, l: any) => s + Number(l.emi_amount ?? 0), 0)
  const sip  = investments.filter((i: any) => i.is_sip && i.sip_amount).reduce((s: number, i: any) => s + Number(i.sip_amount ?? 0), 0)
  const card = cards.reduce((s: number, c: any) => s + Number(c.current_outstanding ?? 0) / 12, 0)
  const totalOut = emi + sip + card
  if (totalOut < 1) return null

  const income  = Math.max(totalOut * 1.3, 10000)
  const savings = Math.max(income - totalOut, 0)

  const nodeNames: string[] = ['Income']
  const links: { source: string; target: string; value: number }[] = []

  const addFlow = (label: string, value: number) => {
    if (value < 1) return
    nodeNames.push(label)
    links.push({ source: 'Income', target: label, value: Math.round(value) })
  }

  addFlow('Loan EMIs',        emi)
  addFlow('SIP / Invest.',    sip)
  addFlow('Card Bills',       card)
  if (savings > 0) addFlow('Savings', savings)

  if (!links.length) return null

  const colors: Record<string, string> = {
    Income: '#22C55E', 'Loan EMIs': '#EF4444', 'SIP / Invest.': '#10B981',
    'Card Bills': '#F97316', Savings: '#F59E0B',
  }
  const uniqueNodes = [...new Set(nodeNames)].map(name => ({ name }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>₹${Number(p.value ?? 0).toLocaleString('en-IN')}`,
    },
    series: [{
      type: 'sankey', layout: 'none', emphasis: { focus: 'adjacency' },
      data: uniqueNodes.map(n => ({ name: n.name, itemStyle: { color: colors[n.name] ?? '#A09890' } })),
      links,
      lineStyle: { color: 'gradient', opacity: 0.4, curveness: 0.5 },
      itemStyle: { borderRadius: 6 },
      label: { color: '#1C1410', fontFamily: 'system-ui',
        formatter: (p: any) => `${p.name}\n₹${((Number(p.value) ?? 0) / 1000).toFixed(0)}K` },
      nodeWidth: 20, nodeGap: 14, orient: 'horizontal',
    }],
  }
}

// ── D3 Multi-level Force Graph ─────────────────────────────────────────────────

function D3ForceGraph({ nodes: rawNodes, links: rawLinks }: { nodes: D3Node[]; links: D3Link[] }) {
  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const simRef       = useRef<d3.Simulation<D3Node, D3Link> | null>(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !rawNodes.length) return
    simRef.current?.stop()

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    const cx = width / 2, cy = height / 2
    const minDim = Math.min(width, height)

    // Radii for each ring
    const r1 = minDim * 0.20   // hub ring
    const r2 = minDim * 0.42   // item ring

    // Node radius scale per level
    const maxL1 = d3.max(rawNodes.filter(n => n.level === 1), d => d.value) ?? 1
    const maxL2 = d3.max(rawNodes.filter(n => n.level === 2), d => d.value) ?? 1
    const l1R = d3.scaleSqrt().domain([0, maxL1]).range([24, 38])
    const l2R = d3.scaleSqrt().domain([0, maxL2]).range([13, 24])
    const nodeR = (n: D3Node) => n.level === 0 ? 52 : n.level === 1 ? l1R(n.value) : l2R(n.value)

    // Clone nodes & links
    const nodes: D3Node[] = rawNodes.map(d => ({ ...d }))
    const links: D3Link[] = rawLinks.map(d => ({ ...d }))

    // Fix L0 at center
    const center = nodes.find(n => n.level === 0)
    if (center) { center.fx = cx; center.fy = cy }

    // Fix L1 hubs at evenly-spaced angles on inner ring
    const hubs = nodes.filter(n => n.level === 1)
    hubs.forEach((hub, i) => {
      const angle = (i / hubs.length) * 2 * Math.PI - Math.PI / 2
      hub.fx = cx + Math.cos(angle) * r1
      hub.fy = cy + Math.sin(angle) * r1
    })

    // Initialise L2 items deterministically in an arc behind their hub
    hubs.forEach((hub, hi) => {
      const hubItems = nodes.filter(n => n.level === 2 && n.hubId === hub.id)
      const hubAngle = (hi / hubs.length) * 2 * Math.PI - Math.PI / 2
      const arcSpan  = Math.min(Math.PI * 0.55, 0.3 + hubItems.length * 0.18)

      hubItems.forEach((item, ji) => {
        const t     = hubItems.length > 1 ? ji / (hubItems.length - 1) : 0.5
        const angle = hubAngle - arcSpan / 2 + t * arcSpan
        // small jitter to avoid stacking
        const jitter = (ji % 2 === 0 ? 0 : 14)
        item.x = cx + Math.cos(angle) * (r2 + jitter)
        item.y = cy + Math.sin(angle) * (r2 + jitter)
      })
    })

    // ── Defs ────────────────────────────────────────────────────────────────
    const defs = svg.append('defs')
    const shadow = defs.append('filter').attr('id', 'dropshadow')
      .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
    shadow.append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 5).attr('flood-color', 'rgba(0,0,0,0.16)')

    const shadowSm = defs.append('filter').attr('id', 'dropshadow-sm')
      .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
    shadowSm.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 3).attr('flood-color', 'rgba(0,0,0,0.10)')

    const g = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 4])
        .on('zoom', e => g.attr('transform', e.transform))
    )

    // ── Links ────────────────────────────────────────────────────────────────
    // L0↔L1: thick solid
    const l01Links = links.filter((d: any) => {
      const src = rawNodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id))
      return src?.level === 1
    })
    // L1↔L2: thin dashed
    const l12Links = links.filter((d: any) => {
      const src = rawNodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id))
      return src?.level === 2
    })

    const drawLinks = (lks: D3Link[], opts: { width: number; opacity: number; dash?: string }) =>
      g.append('g').selectAll('line').data(lks).join('line')
        .attr('stroke', (d: any) => {
          const src = rawNodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as D3Node).id))
          return src?.color ?? '#A09890'
        })
        .attr('stroke-width', opts.width)
        .attr('stroke-opacity', opts.opacity)
        .attr('stroke-dasharray', opts.dash ?? null)

    const linkSel01 = drawLinks(l01Links, { width: 2.5, opacity: 0.35 })
    const linkSel12 = drawLinks(l12Links, { width: 1.5, opacity: 0.25, dash: '4,3' })

    // ── Nodes ────────────────────────────────────────────────────────────────
    const nodeSel = g.append('g')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', d => d.level === 2 ? 'pointer' : 'default')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (e, d) => { if (d.level !== 2) return; if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  (e, d) => { if (d.level !== 2) return; d.fx = e.x; d.fy = e.y })
          .on('end',   (e, d) => { if (d.level !== 2) return; if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // Outer glow ring for L1 hubs
    nodeSel.filter(d => d.level === 1)
      .append('circle')
      .attr('r', d => nodeR(d) + 8)
      .attr('fill', d => d.color + '20')
      .attr('stroke', d => d.color + '55')
      .attr('stroke-width', 1.5)

    // Main circle
    nodeSel.append('circle')
      .attr('r', d => nodeR(d))
      .attr('fill', d => {
        if (d.level === 0) return 'url(#grad0)'  // will define below, fallback:
        return d.color
      })
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', d => d.level === 0 ? 4 : d.level === 1 ? 3 : 2)
      .attr('filter', d => d.level <= 1 ? 'url(#dropshadow)' : 'url(#dropshadow-sm)')
      .attr('opacity', d => d.level === 2 ? 0.88 : 1)

    // Emoji
    nodeSel.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', d => {
        if (d.level === 0) return '28px'
        if (d.level === 1) return '18px'
        return '13px'
      })
      .text(d => d.emoji)

    // Name label below circle
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => nodeR(d) + (d.level === 0 ? 18 : d.level === 1 ? 14 : 12))
      .attr('font-size', d => d.level === 0 ? 13 : d.level === 1 ? 11 : 10)
      .attr('font-weight', d => d.level <= 1 ? '700' : '500')
      .attr('fill', '#1C1410')
      .text(d => d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name)

    // Value label
    nodeSel.filter(d => d.level <= 1)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => nodeR(d) + (d.level === 0 ? 31 : 26))
      .attr('font-size', 10)
      .attr('fill', '#6B6460')
      .text(d => formatCurrencyCompact(d.value))

    // ── Tooltip ──────────────────────────────────────────────────────────────
    const tip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseover', (e, d) => {
        tip.style('opacity', '1')
          .html([
            `<div style="font-size:22px;margin-bottom:4px">${d.emoji}</div>`,
            `<div style="font-weight:700;color:#1C1410;font-size:13px">${d.name}</div>`,
            `<div style="color:#F97316;font-weight:600;font-size:14px;margin-top:2px">${formatCurrency(d.value)}</div>`,
            `<div style="font-size:11px;color:#A09890;text-transform:capitalize;margin-top:2px">${d.type.replace('_', ' ')}</div>`,
          ].join(''))
        d3.select(e.currentTarget).select('circle').attr('stroke', '#F97316').attr('stroke-width', 3)
      })
      .on('mousemove', e => {
        const rc = containerRef.current!.getBoundingClientRect()
        tip.style('left', `${e.clientX - rc.left + 14}px`).style('top', `${e.clientY - rc.top - 12}px`)
      })
      .on('mouseout', e => {
        tip.style('opacity', '0')
        const el = d3.select<SVGGElement, D3Node>(e.currentTarget as SVGGElement)
        const lv = el.datum().level
        el.select('circle').attr('stroke', '#fff').attr('stroke-width', lv === 0 ? 4 : lv === 1 ? 3 : 2)
      })

    // ── Simulation ───────────────────────────────────────────────────────────
    const allLinks = [...l01Links, ...l12Links]
    const sim = d3.forceSimulation<D3Node>(nodes)
      .force('link',
        d3.forceLink<D3Node, D3Link>(links)
          .id(d => d.id)
          .distance((d: any) => {
            const src = typeof d.source === 'object' ? d.source as D3Node : nodes.find(n => n.id === d.source)
            return src?.level === 2 ? 85 : 0
          })
          .strength((d: any) => {
            const src = typeof d.source === 'object' ? d.source as D3Node : nodes.find(n => n.id === d.source)
            return src?.level === 2 ? 1.2 : 0
          })
      )
      .force('charge', d3.forceManyBody<D3Node>().strength(d => d.level === 2 ? -70 : 0))
      .force('collision', d3.forceCollide<D3Node>(d => nodeR(d) + 10))
    simRef.current = sim

    const tickAll = () => {
      ;[linkSel01, linkSel12].forEach(sel =>
        sel
          .attr('x1', (d: any) => ((d.source as D3Node).x ?? 0))
          .attr('y1', (d: any) => ((d.source as D3Node).y ?? 0))
          .attr('x2', (d: any) => ((d.target as D3Node).x ?? 0))
          .attr('y2', (d: any) => ((d.target as D3Node).y ?? 0))
      )
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }
    sim.on('tick', tickAll)
  }, [rawNodes, rawLinks])

  useEffect(() => { draw(); return () => { simRef.current?.stop() } }, [draw])

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ minHeight: 480 }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ background: 'transparent', borderRadius: 12 }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
          background: 'rgba(255,255,255,0.97)', border: '1px solid #E8E2DA', borderRadius: 12,
          padding: '12px 16px', boxShadow: '0 6px 24px rgba(0,0,0,0.13)', minWidth: 150,
          fontSize: 13, lineHeight: 1.6, zIndex: 50, textAlign: 'center',
        }}
      />
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function GraphSkeleton() {
  const pts = [
    { cx: '50%', cy: '50%', r: 52 },
    { cx: '50%', cy: '26%', r: 32 },{ cx: '73%', cy: '37%', r: 32 },{ cx: '73%', cy: '63%', r: 32 },
    { cx: '50%', cy: '74%', r: 32 },{ cx: '27%', cy: '63%', r: 32 },{ cx: '27%', cy: '37%', r: 32 },
    { cx: '50%', cy: '10%', r: 18 },{ cx: '83%', cy: '26%', r: 18 },{ cx: '88%', cy: '55%', r: 18 },
    { cx: '12%', cy: '26%', r: 18 },{ cx: '12%', cy: '74%', r: 18 },
  ]
  return (
    <svg width="100%" height="100%" style={{ borderRadius: 12 }}>
      {pts.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#E8E2DA">
          <animate attributeName="opacity" values="0.35;0.85;0.35" dur="1.6s" repeatCount="indefinite" begin={`${i * 0.12}s`} />
        </circle>
      ))}
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VisualizationView() {
  const [tab, setTab] = useState<Tab>('universe')

  // ── Same queries as Settings Excel export (shared TanStack cache) ──────────
  const { data: nwData, isLoading: nwLoading } = useQuery({
    queryKey: ['net-worth'],
    queryFn:  async () => (await api.get('/net-worth/current')).data,
  })
  const { data: history = [] } = useQuery<HistoryPoint[]>({
    queryKey: ['net-worth-history'],
    queryFn:  async () => (await api.get('/net-worth/history')).data,
  })
  const { data: cardsRaw  } = useQuery({ queryKey: ['cards'],         queryFn: async () => (await api.get('/cards?page_size=200')).data })
  const { data: loansRaw  } = useQuery({ queryKey: ['loans'],         queryFn: async () => (await api.get('/loans')).data })
  const { data: invRaw    } = useQuery({ queryKey: ['investments'],    queryFn: async () => (await api.get('/investments')).data })
  const { data: assetsRaw } = useQuery({ queryKey: ['assets'],        queryFn: async () => (await api.get('/assets')).data })
  const { data: banksRaw  } = useQuery({ queryKey: ['bank-accounts'], queryFn: async () => (await api.get('/bank-accounts')).data })

  const banks       = useMemo(() => (banksRaw?.items  ?? banksRaw  ?? []) as any[], [banksRaw])
  const cards       = useMemo(() => (cardsRaw?.items  ?? cardsRaw  ?? []) as any[], [cardsRaw])
  const loans       = useMemo(() => (loansRaw?.items  ?? loansRaw  ?? []) as any[], [loansRaw])
  const investments = useMemo(() => (Array.isArray(invRaw)    ? invRaw    : invRaw?.items    ?? []) as any[], [invRaw])
  const assets      = useMemo(() => (Array.isArray(assetsRaw) ? assetsRaw : assetsRaw?.items ?? []) as any[], [assetsRaw])

  const nwValue = Number(nwData?.net_worth ?? 0)

  // ── Build graph (multi-level) ──────────────────────────────────────────────
  const { nodes: d3Nodes, links: d3Links } = useMemo(
    () => buildD3Graph(banks, cards, loans, investments, assets, nwValue),
    [banks, cards, loans, investments, assets, nwValue],
  )

  // ── Sankey option ──────────────────────────────────────────────────────────
  const sankeyOption = useMemo(() => buildSankeyOption(loans, investments, cards), [loans, investments, cards])

  // ── Sunburst ───────────────────────────────────────────────────────────────
  const getSunburstOption = () => {
    const alloc: AllocationItem[] = nwData?.allocation ?? []
    return {
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${p.name}<br/>${formatCurrency(p.value)}<br/>${p.percent?.toFixed(1) ?? ''}%` },
      series: [{
        type: 'sunburst', radius: ['18%', '82%'],
        data: alloc.map((item, i) => ({ name: item.label, value: item.value, itemStyle: { color: ALLOC_COLORS[i % ALLOC_COLORS.length] } })),
        itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#FBF8F4' },
        label: { rotate: 'radial', minAngle: 8 },
        emphasis: { focus: 'ancestor' },
        levels: [
          {},
          { r0: '18%', r: '52%', label: { align: 'right' }, itemStyle: { borderWidth: 2 } },
          { r0: '52%', r: '82%', label: { position: 'outside', padding: 3 }, itemStyle: { borderWidth: 2 } },
        ],
      }],
    }
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  const getTimelineOption = () => {
    if (!history.length) return {}
    const dates    = history.map(h => h.date)
    const aVals    = history.map(h => h.assets)
    const lVals    = history.map(h => h.liabilities)
    const nwVals   = history.map(h => h.net_worth)
    const maxNW    = nwVals.length ? Math.max(...nwVals) : 0
    const maxIdx   = nwVals.indexOf(maxNW)

    const mk = (name: string, data: number[], color: string, extra: object = {}) => ({
      name, type: 'line', data, smooth: true, symbol: 'none',
      lineStyle: { color, width: 2.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '55' }, { offset: 1, color: color + '05' }] } },
      itemStyle: { color }, ...extra,
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross' },
        formatter: (params: any[]) => `<b>${params[0].axisValue}</b><br/>` + params.map(p => `${p.seriesName}: ${formatCurrencyCompact(p.value)}`).join('<br/>'),
      },
      legend: { top: 0, data: ['Assets', 'Liabilities', 'Net Worth'], textStyle: { color: '#6B6460' } },
      grid: { top: 40, bottom: 60, left: 70, right: 20 },
      xAxis: {
        type: 'category', data: dates,
        axisLabel: {
          color: '#A09890', fontSize: 11,
          formatter: (val: string) => {
            const d = new Date(val)
            return isNaN(d.getTime()) ? val : d.toLocaleString('en', { month: 'short', year: '2-digit' })
          },
        },
      },
      yAxis: { type: 'value', axisLabel: { color: '#A09890', fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) } },
      dataZoom: [{ type: 'slider', bottom: 4, height: 22, borderColor: '#E8E2DA', fillerColor: 'rgba(249,115,22,0.12)', handleStyle: { color: '#F97316' } }],
      animationDuration: 1400,
      series: [
        mk('Assets', aVals, '#10B981'),
        mk('Liabilities', lVals, '#F97316'),
        mk('Net Worth', nwVals, '#7C3AED', {
          markPoint: maxIdx >= 0 ? { data: [{ name: 'Peak', coord: [dates[maxIdx], maxNW], symbol: 'pin', itemStyle: { color: '#7C3AED' } }] } : undefined,
        }),
      ],
    }
  }

  // Cash flow summary
  const emi      = loans.reduce((s: number, l: any) => s + Number(l.emi_amount ?? 0), 0)
  const sip      = investments.filter((i: any) => i.is_sip && i.sip_amount).reduce((s: number, i: any) => s + Number(i.sip_amount ?? 0), 0)
  const cardBill = cards.reduce((s: number, c: any) => s + Number(c.current_outstanding ?? 0) / 12, 0)
  const totalOut = emi + sip + cardBill
  const estIncome = totalOut > 0 ? Math.max(totalOut * 1.3, 10000) : 0
  const netFlow   = estIncome - totalOut

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: '#FBF8F4', overflow: 'hidden' }}>
      <PageHeader
        icon={Telescope}
        title="Financial Universe"
        subtitle="Interactive visualization of your complete financial life"
      />

      {/* Tab bar */}
      <div className="px-4 md:px-6 pt-3 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
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

      {/* Tab content — fills remaining height */}
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <AnimatePresence mode="wait">

          {/* ── Universe ────────────────────────────────────────────────── */}
          {tab === 'universe' && (
            <motion.div key="universe" className="h-full flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="card flex flex-col flex-1 mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Financial Relationship Graph</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>
                    3 levels: Net Worth → Categories → Accounts · Drag items · Scroll to zoom
                  </p>
                </div>
                <div className="flex-1 p-3">
                  {nwLoading
                    ? <GraphSkeleton />
                    : d3Nodes.length > 0
                      ? <D3ForceGraph nodes={d3Nodes} links={d3Links} />
                      : (
                        <div className="h-full flex items-center justify-center" style={{ color: '#A09890', fontSize: 14 }}>
                          Add banks, cards, loans or investments to see your financial universe.
                        </div>
                      )
                  }
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Cash Flow ───────────────────────────────────────────────── */}
          {tab === 'cashflow' && (
            <motion.div key="cashflow" className="h-full flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="card flex flex-col flex-1 mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Monthly Cash Flow</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>How money flows through your financial life</p>
                </div>
                <div className="flex-1 p-4 flex flex-col">
                  <div className="flex-1">
                    {sankeyOption
                      ? <ReactECharts key="sankey" option={sankeyOption} notMerge style={{ height: '100%', minHeight: 320 }} />
                      : <div className="h-full flex items-center justify-center" style={{ color: '#A09890', fontSize: 14, minHeight: 320 }}>
                          Add loans, SIPs or credit cards to see cash flow.
                        </div>
                    }
                  </div>
                  {totalOut > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-4 flex-shrink-0">
                      {[
                        { label: 'Est. Monthly Income', value: estIncome, color: '#22C55E' },
                        { label: 'Monthly Outflow',     value: totalOut,  color: '#EF4444' },
                        { label: 'Net Flow',             value: netFlow,   color: netFlow >= 0 ? '#22C55E' : '#EF4444' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl text-center" style={{ padding: '14px 12px', background: '#FAF7F4', border: '1px solid #EDE8E2' }}>
                          <div className="text-[11px] font-semibold mb-1" style={{ color: '#A09890' }}>{s.label}</div>
                          <div className="text-[16px] font-extrabold" style={{ color: s.color }}>{formatCurrencyCompact(s.value)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Allocation ──────────────────────────────────────────────── */}
          {tab === 'allocation' && (
            <motion.div key="allocation" className="h-full flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="card flex flex-col flex-1 mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Asset Allocation</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Breakdown of your wealth distribution</p>
                </div>
                <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
                  {/* Chart fills remaining space */}
                  <div className="flex-1 min-w-0 p-4">
                    {nwData?.allocation?.length
                      ? <ReactECharts key="sunburst" option={getSunburstOption()} notMerge style={{ height: '100%', minHeight: 340 }} />
                      : <div className="h-full flex items-center justify-center" style={{ color: '#A09890', minHeight: 340 }}>No allocation data.</div>
                    }
                  </div>
                  {/* Legend sidebar */}
                  {nwData?.allocation?.length ? (
                    <div className="md:w-56 flex flex-col gap-1.5 p-4 overflow-y-auto" style={{ borderLeft: '1px solid #F0EBE4' }}>
                      <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#A09890' }}>Breakdown</div>
                      {(nwData.allocation as AllocationItem[]).map((item, i) => (
                        <div key={item.label} className="flex items-center gap-2.5 py-2 px-3 rounded-xl" style={{ background: '#FAF7F4' }}>
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

          {/* ── Timeline ────────────────────────────────────────────────── */}
          {tab === 'timeline' && (
            <motion.div key="timeline" className="h-full flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="card flex flex-col flex-1 mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Net Worth Timeline</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Your wealth journey over time</p>
                </div>
                <div className="flex-1 p-4">
                  {history.length
                    ? <ReactECharts key="timeline" option={getTimelineOption()} notMerge style={{ height: '100%', minHeight: 340 }} />
                    : <div className="h-full flex items-center justify-center" style={{ color: '#A09890', minHeight: 340 }}>No history yet.</div>
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
