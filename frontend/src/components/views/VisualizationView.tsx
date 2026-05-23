'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

interface GraphNode {
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

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
  value: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  sankey: { nodes: { name: string }[]; links: { source: string; target: string; value: number }[] }
  summary: { total_inflow: number; total_outflow: number; net_flow: number }
}

interface AllocationItem {
  label: string
  value: number
  pct: number
}

interface NetWorthData {
  total_assets: number
  total_liabilities: number
  net_worth: number
  allocation: AllocationItem[]
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
  investment: '#10B981',
  emi: '#EF4444',
  bill_payment: '#F97316',
  liability: '#EF4444',
  asset: '#8B5CF6',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'universe', label: '🌌 Universe' },
  { id: 'cashflow', label: '💸 Cash Flow' },
  { id: 'allocation', label: '🥧 Allocation' },
  { id: 'timeline', label: '📈 Timeline' },
]

// ── D3 Force Graph ─────────────────────────────────────────────────────────────

function D3ForceGraph({ data }: { data: GraphData }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !data?.nodes?.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()

    // Filters
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'drop-shadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    filter.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 4).attr('flood-color', 'rgba(0,0,0,0.18)')

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (e) => g.attr('transform', e.transform))
    svg.call(zoom)

    const nodeRadius = d3.scaleSqrt().domain([0, d3.max(data.nodes, d => d.value) ?? 1]).range([18, 54])

    // Clone nodes & links to avoid mutation
    const nodes: GraphNode[] = data.nodes.map(d => ({ ...d }))
    const links: GraphLink[] = data.links.map(d => ({ ...d }))

    // Fix networth at center
    const nwNode = nodes.find(n => n.type === 'networth')
    if (nwNode) { nwNode.fx = width / 2; nwNode.fy = height / 2 }

    // Simulation
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>(d => nodeRadius(d.value) + 20))
    simulationRef.current = sim

    // Links
    const linkSel = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => EDGE_COLORS[d.type] ?? '#A09890')
      .attr('stroke-width', d => Math.max(1.5, Math.min(4, (d.value ?? 0) / 5000)))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', d => d.type === 'liability' ? '6,3' : null)

    // Node groups
    const nodeSel = g.append('g').selectAll<SVGGElement, GraphNode>('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); if (d.type !== 'networth') { d.fx = null; d.fy = null } })
      )

    nodeSel.append('circle')
      .attr('r', d => nodeRadius(d.value))
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#drop-shadow)')

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(14, nodeRadius(d.value) * 0.6))
      .text(d => d.emoji)

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => nodeRadius(d.value) + 14)
      .attr('font-size', 11)
      .attr('font-weight', '600')
      .attr('fill', '#1C1410')
      .text(d => d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name)

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => nodeRadius(d.value) + 26)
      .attr('font-size', 10)
      .attr('fill', '#6B6460')
      .text(d => formatCurrencyCompact(d.value))

    // Tooltip interactions
    const tooltip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseover', (e, d) => {
        tooltip.style('opacity', '1')
          .html(`<div style="font-size:20px">${d.emoji}</div><div style="font-weight:700;color:#1C1410">${d.name}</div><div style="color:#F97316;font-weight:600">${formatCurrency(d.value)}</div><div style="font-size:11px;color:#A09890;text-transform:capitalize;margin-top:2px">${d.type}</div>`)
        d3.select(e.currentTarget).select('circle').attr('stroke', '#F97316').attr('stroke-width', 3)
      })
      .on('mousemove', (e) => {
        const rect = containerRef.current!.getBoundingClientRect()
        tooltip.style('left', `${e.clientX - rect.left + 12}px`).style('top', `${e.clientY - rect.top - 10}px`)
      })
      .on('mouseout', (e) => {
        tooltip.style('opacity', '0')
        d3.select(e.currentTarget).select('circle').attr('stroke', '#fff').attr('stroke-width', 2)
      })

    linkSel
      .on('mouseover', (e, d) => {
        const src = (d.source as GraphNode).name ?? d.source
        const tgt = (d.target as GraphNode).name ?? d.target
        tooltip.style('opacity', '1')
          .html(`<div style="font-weight:700;color:#1C1410">${src} → ${tgt}</div><div style="color:#F97316;font-weight:600">${formatCurrencyCompact(d.value)}</div><div style="font-size:11px;color:#A09890;text-transform:capitalize">${d.type}</div>`)
        d3.select(e.currentTarget).attr('stroke-opacity', 0.9)
      })
      .on('mousemove', (e) => {
        const rect = containerRef.current!.getBoundingClientRect()
        tooltip.style('left', `${e.clientX - rect.left + 12}px`).style('top', `${e.clientY - rect.top - 10}px`)
      })
      .on('mouseout', (e) => {
        tooltip.style('opacity', '0')
        d3.select(e.currentTarget).attr('stroke-opacity', 0.4)
      })

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })
  }, [data])

  useEffect(() => {
    draw()
    return () => { simulationRef.current?.stop() }
  }, [draw])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 500 }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ background: '#FAFAF8', borderRadius: 12 }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E8E2DA', borderRadius: 10,
          padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 140,
          fontSize: 13, lineHeight: 1.5, zIndex: 50,
        }}
      />
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function GraphSkeleton() {
  const circles = [
    { cx: '50%', cy: '50%', r: 50 },
    { cx: '25%', cy: '30%', r: 32 },
    { cx: '75%', cy: '30%', r: 32 },
    { cx: '20%', cy: '68%', r: 26 },
    { cx: '80%', cy: '68%', r: 26 },
    { cx: '50%', cy: '20%', r: 22 },
  ]
  return (
    <div style={{ height: 500, background: '#FAFAF8', borderRadius: 12, overflow: 'hidden' }}>
      <svg width="100%" height="100%">
        {circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="#E8E2DA">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
          </circle>
        ))}
      </svg>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VisualizationView() {
  const [tab, setTab] = useState<Tab>('universe')

  const { data: graphData, isLoading: graphLoading } = useQuery<GraphData>({
    queryKey: ['financial-graph'],
    queryFn: async () => (await api.get('/reports/financial-graph')).data,
  })

  const { data: nw } = useQuery<NetWorthData>({
    queryKey: ['net-worth'],
    queryFn: async () => (await api.get('/net-worth/current')).data,
  })

  const { data: history = [] } = useQuery<HistoryPoint[]>({
    queryKey: ['net-worth-history'],
    queryFn: async () => (await api.get('/net-worth/history')).data,
  })

  // ── ECharts: Sankey ──────────────────────────────────────────────────────────

  const sankeyNodeColors: Record<string, string> = {
    Salary: '#22C55E', Income: '#22C55E', SIP: '#10B981',
    EMI: '#EF4444', 'Card Bills': '#F97316', Subscriptions: '#8B5CF6',
    Utilities: '#06B6D4', Savings: '#F59E0B',
  }

  const getSankeyOption = () => {
    if (!graphData?.sankey) return {}
    const coloredNodes = (graphData.sankey.nodes ?? []).map(n => ({
      name: n.name,
      itemStyle: { color: sankeyNodeColors[n.name] ?? '#A09890' },
    }))
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: { name: string; value: number }) =>
          `${p.name}<br/>₹${Number(p.value ?? 0).toLocaleString('en-IN')}`,
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        data: coloredNodes,
        links: graphData.sankey.links ?? [],
        lineStyle: { color: 'gradient', opacity: 0.4, curveness: 0.5 },
        itemStyle: { borderRadius: 6 },
        label: {
          color: '#1C1410',
          fontFamily: 'system-ui',
          formatter: (p: { name: string; value: number }) =>
            `${p.name}\n₹${((p.value ?? 0) / 1000).toFixed(0)}K`,
        },
        nodeWidth: 20,
        nodeGap: 12,
        orient: 'horizontal',
      }],
    }
  }

  // ── ECharts: Sunburst ────────────────────────────────────────────────────────

  const getSunburstOption = () => {
    const alloc = nw?.allocation ?? []
    const sunData = alloc.map((item, i) => ({
      name: item.label,
      value: item.value,
      itemStyle: { color: ALLOC_COLORS[i % ALLOC_COLORS.length] },
    }))
    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/>${formatCurrency(p.value)}<br/>${p.percent?.toFixed(1) ?? ''}%`,
      },
      series: [{
        type: 'sunburst',
        radius: ['20%', '80%'],
        data: sunData,
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

  // ── ECharts: Timeline ────────────────────────────────────────────────────────

  const getTimelineOption = () => {
    const dates = history.map(h => h.date)
    const assets = history.map(h => h.assets)
    const liabs = history.map(h => h.liabilities)
    const netW = history.map(h => h.net_worth)
    const maxNW = Math.max(...netW)
    const maxIdx = netW.indexOf(maxNW)

    const makeSeries = (name: string, data: number[], color: string, extra: object = {}) => ({
      name,
      type: 'line',
      data,
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '55' }, { offset: 1, color: color + '05' }] } },
      itemStyle: { color },
      ...extra,
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: { axisValue: string; seriesName: string; value: number }[]) => {
          const d = params[0].axisValue
          return `<b>${d}</b><br/>` + params.map(p => `${p.seriesName}: ${formatCurrencyCompact(p.value)}`).join('<br/>')
        },
      },
      legend: { top: 0, data: ['Assets', 'Liabilities', 'Net Worth'], textStyle: { color: '#6B6460' } },
      grid: { top: 40, bottom: 60, left: 60, right: 20 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#A09890', fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { color: '#A09890', fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) } },
      dataZoom: [{ type: 'slider', bottom: 4, height: 22, borderColor: '#E8E2DA', fillerColor: 'rgba(249,115,22,0.12)', handleStyle: { color: '#F97316' } }],
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      series: [
        makeSeries('Assets', assets, '#10B981'),
        makeSeries('Liabilities', liabs, '#F97316'),
        makeSeries('Net Worth', netW, '#7C3AED', {
          markPoint: {
            data: [{ name: 'Max NW', coord: [dates[maxIdx], maxNW], symbol: 'pin', itemStyle: { color: '#7C3AED' } }],
          },
        }),
      ],
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const netFlow = graphData?.summary?.net_flow ?? 0

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
              color: tab === t.id ? '#fff' : '#6B6460',
              border: `1.5px solid ${tab === t.id ? '#F97316' : '#E8E2DA'}`,
              boxShadow: tab === t.id ? '0 2px 8px rgba(249,115,22,0.28)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <AnimatePresence mode="wait">
          {tab === 'universe' && (
            <motion.div key="universe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Financial Relationship Graph</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Drag nodes · Scroll to zoom · Hover for details</p>
                </div>
                <div className="p-3">
                  {graphLoading ? <GraphSkeleton /> : graphData?.nodes?.length ? <D3ForceGraph data={graphData} /> : (
                    <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>
                      No financial data available yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'cashflow' && (
            <motion.div key="cashflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Monthly Cash Flow</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>How money flows through your financial life</p>
                </div>
                <div className="p-4">
                  {graphLoading ? (
                    <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ color: '#A09890' }}>Loading…</div>
                    </div>
                  ) : graphData?.sankey?.nodes?.length ? (
                    <ReactECharts option={getSankeyOption()} style={{ height: '420px' }} />
                  ) : (
                    <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>
                      No cash flow data available.
                    </div>
                  )}
                </div>
              </div>

              {/* Summary cards */}
              {graphData?.summary && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { label: 'Monthly Inflow', value: graphData.summary.total_inflow, color: '#22C55E' },
                    { label: 'Monthly Outflow', value: graphData.summary.total_outflow, color: '#EF4444' },
                    { label: 'Net Flow', value: netFlow, color: netFlow >= 0 ? '#22C55E' : '#EF4444' },
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

          {tab === 'allocation' && (
            <motion.div key="allocation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Asset Allocation</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Breakdown of your wealth distribution</p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 p-4">
                  {/* Sunburst */}
                  <div className="flex-1 min-w-0">
                    {nw?.allocation?.length ? (
                      <ReactECharts option={getSunburstOption()} style={{ height: '420px' }} />
                    ) : (
                      <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>
                        No allocation data available.
                      </div>
                    )}
                  </div>

                  {/* Legend table */}
                  {nw?.allocation?.length ? (
                    <div className="md:w-52 flex flex-col gap-1.5 self-center">
                      {nw.allocation.map((item, i) => (
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

          {tab === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <h2 className="text-[14px] font-bold" style={{ color: '#18120E' }}>Net Worth Timeline</h2>
                  <p className="text-[12px] mt-0.5" style={{ color: '#A09890' }}>Your wealth journey over time</p>
                </div>
                <div className="p-4">
                  {history.length ? (
                    <ReactECharts option={getTimelineOption()} style={{ height: '420px' }} />
                  ) : (
                    <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890', fontSize: 14 }}>
                      No history data available yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
