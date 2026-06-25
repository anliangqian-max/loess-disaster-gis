import './style.css'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as echarts from 'echarts'
import * as turf from '@turf/turf'

// ── Basemap tile definitions ──────────────────────────────────────────────
const BASEMAPS = {
  'osm-dark': {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    },
  },
  'osm-topo': {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '© OpenTopoMap',
      maxZoom: 17,
    },
  },
  'osm-light': {
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    options: {
      attribution: '© 高德地图',
      subdomains: '1234',
      maxZoom: 18,
    },
  },
}

// ── Simulated hydrology stations ──────────────────────────────────────────
const HYDRO_STATIONS = [
  {
    id: 1,
    name: '固原水文站',
    lat: 36.0156,
    lng: 106.2428,
    currentWaterLevel: 523.4,
    rainfall24h: [0.5, 1.2, 2.3, 3.1, 5.6, 8.2, 12.4, 15.8, 18.2, 16.5, 14.3, 12.1, 9.8, 7.6, 5.4, 4.2, 3.5, 2.8, 2.1, 1.5, 1.0, 0.8, 0.6, 0.3]
  },
  {
    id: 2,
    name: '庆阳水文站',
    lat: 35.7342,
    lng: 107.6434,
    currentWaterLevel: 1298.7,
    rainfall24h: [0.3, 0.8, 1.5, 2.8, 4.5, 6.8, 9.2, 11.5, 13.8, 15.2, 14.6, 12.9, 10.5, 8.2, 6.3, 4.8, 3.6, 2.9, 2.2, 1.7, 1.2, 0.9, 0.6, 0.4]
  },
  {
    id: 3,
    name: '延安水文站',
    lat: 36.5853,
    lng: 109.4897,
    currentWaterLevel: 958.5,
    rainfall24h: [0.8, 1.5, 2.8, 4.2, 6.5, 9.8, 13.5, 16.8, 19.2, 17.5, 15.2, 13.8, 11.5, 9.2, 7.5, 5.8, 4.5, 3.6, 2.8, 2.1, 1.5, 1.1, 0.8, 0.5]
  },
  {
    id: 4,
    name: '榆林水文站',
    lat: 38.2659,
    lng: 109.7346,
    currentWaterLevel: 1157.2,
    rainfall24h: [0.2, 0.6, 1.2, 2.1, 3.8, 5.6, 7.8, 10.2, 12.5, 14.2, 13.5, 11.8, 9.5, 7.2, 5.5, 4.2, 3.2, 2.5, 1.9, 1.4, 1.0, 0.7, 0.5, 0.3]
  },
  {
    id: 5,
    name: '平凉水文站',
    lat: 35.5430,
    lng: 106.6652,
    currentWaterLevel: 1346.8,
    rainfall24h: [0.4, 1.0, 1.8, 3.2, 5.2, 7.8, 10.5, 13.2, 15.8, 17.2, 16.5, 14.8, 12.5, 10.2, 8.2, 6.5, 5.0, 4.0, 3.2, 2.5, 1.8, 1.3, 0.9, 0.5]
  }
]

// ── Simulated landslide hazard points ─────────────────────────────────────
const LANDSLIDE_POINTS = [
  { id: 'L1', name: '黄土梁滑坡隐患点', lat: 36.2345, lng: 106.5678 },
  { id: 'L2', name: '泾河谷地隐患点', lat: 35.8912, lng: 107.2345 },
  { id: 'L3', name: '洛川塬面隐患点', lat: 36.8234, lng: 109.4321 },
  { id: 'L4', name: '白于山地隐患点', lat: 37.9876, lng: 109.3456 },
  { id: 'L5', name: '六盘山麓隐患点', lat: 35.6789, lng: 106.3456 }
]

// ── Map initialisation ────────────────────────────────────────────────────
function initMap() {
  const map = L.map('map', {
    center: [37.0, 108.0],
    zoom: 7,
    zoomControl: true,
  })

  let currentLayer = L.tileLayer(
    BASEMAPS['osm-dark'].url,
    BASEMAPS['osm-dark'].options
  ).addTo(map)

  return { map, getCurrentLayer: () => currentLayer, setCurrentLayer: (l) => { currentLayer = l } }
}

// ── Basemap control ───────────────────────────────────────────────────────
function initBasemapControl(map, getCurrentLayer, setCurrentLayer) {
  document.querySelectorAll('.bm-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.bm
      const def = BASEMAPS[key]
      if (!def) return

      map.removeLayer(getCurrentLayer())
      const next = L.tileLayer(def.url, def.options).addTo(map)
      setCurrentLayer(next)

      document.getElementById('map').classList.toggle('no-filter', key === 'osm-light')

      document.querySelectorAll('.bm-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })
}

// ── ECharts initialization ────────────────────────────────────────────────
let myChart = null
let selectedStation = null

function initECharts() {
  const chartDom = document.getElementById('rainfall-chart')
  if (!chartDom) {
    console.error('ECharts container #rainfall-chart not found')
    return null
  }

  myChart = echarts.init(chartDom)
  console.log('ECharts initialized successfully')

  const option = {
    title: {
      text: '降雨量趋势',
      left: 'center',
      textStyle: { color: '#e5e7eb', fontSize: 14 }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}时: {c} mm'
    },
    grid: {
      left: '10%',
      right: '10%',
      top: '20%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}时`),
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } }
    },
    yAxis: {
      type: 'value',
      name: '降雨量(mm)',
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
    },
    series: [
      {
        name: '降雨量',
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
          ])
        },
        itemStyle: { color: '#3b82f6' }
      }
    ]
  }

  myChart.setOption(option)
  return myChart
}

function updateRainfallChart(station) {
  if (!myChart) {
    console.error('ECharts instance not initialized')
    return
  }

  console.log('Updating chart for station:', station.name)

  myChart.setOption({
    title: {
      text: `${station.name} - 24小时降雨量趋势`
    },
    series: [{
      data: station.rainfall24h
    }]
  })

  selectedStation = station
}

// ── Add hydrology stations to map ─────────────────────────────────────────
function addHydroStations(map) {
  const blueIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: #3b82f6;
      border: 2px solid #fff;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })

  HYDRO_STATIONS.forEach(station => {
    const marker = L.marker([station.lat, station.lng], { icon: blueIcon })
      .bindPopup(`
        <div style="font-size: 13px; line-height: 1.6;">
          <strong style="color: #1f2937;">${station.name}</strong><br/>
          <span style="color: #6b7280;">水位: ${station.currentWaterLevel} m</span><br/>
          <span style="color: #6b7280;">当前降雨: ${station.rainfall24h[station.rainfall24h.length - 1]} mm</span>
        </div>
      `)
      .addTo(map)

    marker.on('click', () => {
      console.log('Station clicked:', station.name)
      updateRainfallChart(station)
    })
  })
}

// ── Add landslide hazard points to map ────────────────────────────────────
function addLandslidePoints(map) {
  const redIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: #ef4444;
      border: 2px solid #fff;
      width: 12px;
      height: 12px;
      transform: rotate(45deg);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  })

  LANDSLIDE_POINTS.forEach(point => {
    L.marker([point.lat, point.lng], { icon: redIcon })
      .addTo(map)
      .bindPopup(`
        <div style="font-size: 13px; line-height: 1.6;">
          <strong style="color: #991b1b;">${point.name}</strong><br/>
          <span style="color: #6b7280;">ID: ${point.id}</span><br/>
          <span style="color: #6b7280;">坐标: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</span>
        </div>
      `)
  })
}

// ── Spatial analysis with Turf.js ─────────────────────────────────────────
function performSpatialAnalysis() {
  if (!selectedStation) {
    alert('请先在地图上选择一个水文站点！')
    return
  }

  const stationPoint = turf.point([selectedStation.lng, selectedStation.lat])

  let nearestPoint = null
  let minDistance = Infinity

  LANDSLIDE_POINTS.forEach(point => {
    const landslidePoint = turf.point([point.lng, point.lat])
    const distance = turf.distance(stationPoint, landslidePoint, { units: 'kilometers' })

    if (distance < minDistance) {
      minDistance = distance
      nearestPoint = point
    }
  })

  const resultPanel = document.getElementById('analysis-result')
  if (resultPanel && nearestPoint) {
    resultPanel.innerHTML = `
      <div style="padding: 12px; background: #1f2937; border-radius: 6px; border-left: 3px solid #ef4444;">
        <div style="font-size: 14px; color: #f3f4f6; margin-bottom: 8px;">
          <strong>空间分析结果</strong>
        </div>
        <div style="font-size: 12px; color: #d1d5db; line-height: 1.6;">
          <strong style="color: #fbbf24;">选中站点:</strong> ${selectedStation.name}<br/>
          <strong style="color: #ef4444;">最近隐患点:</strong> ${nearestPoint.name}<br/>
          <strong style="color: #3b82f6;">距离:</strong> ${minDistance.toFixed(2)} km
        </div>
      </div>
    `
  }
}

function initSpatialAnalysisButton() {
  const btn = document.getElementById('analysis-btn')
  if (!btn) {
    console.error('Analysis button #analysis-btn not found')
    return
  }

  console.log('Spatial analysis button initialized')
  btn.addEventListener('click', performSpatialAnalysis)
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
const { map, getCurrentLayer, setCurrentLayer } = initMap()
initBasemapControl(map, getCurrentLayer, setCurrentLayer)
initECharts()
addHydroStations(map)
addLandslidePoints(map)
initSpatialAnalysisButton()

export { map }
