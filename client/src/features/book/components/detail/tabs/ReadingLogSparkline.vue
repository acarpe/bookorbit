<script setup lang="ts">
import { computed, onMounted, shallowRef, watchEffect } from 'vue'
import VChart from 'vue-echarts'
import type { BookReadingSessionStats } from '@bookorbit/types'
import { useThemeStore } from '@/stores/theme'
import { getBookorbitThemeName, initChartThemes } from '@/lib/echarts'

const props = defineProps<{
  stats: BookReadingSessionStats | null
  loading: boolean
}>()

const themeStore = useThemeStore()
const chartTheme = computed(() => getBookorbitThemeName(themeStore.theme, themeStore.accent))
const hasSummary = computed(() => (props.stats?.dailySummary ?? []).length > 0)
const option = shallowRef({})

onMounted(() => initChartThemes())

watchEffect(() => {
  const summary = props.stats?.dailySummary
  if (!summary || summary.length === 0) return

  option.value = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0]
        if (!p) return ''
        return `${p.name}: <strong>${p.value} min</strong>`
      },
    },
    grid: { left: '2%', right: '2%', top: '6%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: summary.map((d) => d.day),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        interval: Math.max(0, Math.floor(summary.length / 6) - 1),
        formatter: (val: string) => val.slice(5),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 10, formatter: (v: number) => `${v}m` },
    },
    series: [
      {
        type: 'bar',
        data: summary.map((d) => d.totalMinutes),
        barMaxWidth: 12,
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      },
    ],
  }
})
</script>

<template>
  <div v-if="hasSummary" class="w-full transition-opacity" :class="{ 'opacity-50': loading }" style="height: 120px">
    <VChart :theme="chartTheme" :option autoresize class="h-full w-full" />
  </div>
</template>
