"use client"

import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Papa from 'papaparse';
import { ResponsiveCalendar } from '@nivo/calendar';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface Stats {
  totalDuration: string;
  avgDuration: string;
  longestChat: { duration: string; name: string };
}

const Dashboard = () => {
  const [contributionData, setContributionData] = useState<{month: number; week: number; day: number; value: number}[]>([]);
  const [hourlyData, setHourlyData] = useState<{hour: string; count: number}[]>([]);
  const [topTopics, setTopTopics] = useState<{name: string; value: number}[]>([]);
  const [seasonalData, setSeasonalData] = useState<{name: string; value: number}[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalDuration: "0 hrs",
    avgDuration: "0 hrs",
    longestChat: { duration: "0 hrs", name: "" }
  });
  const [tokenStats, setTokenStats] = useState({
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Load conversation data and generate contribution data
        const csvResponse = await fetch('/api/conversation');
        const csvText = await csvResponse.text();
        const conversationData = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data as { start_time: string }[];

        // Generate contribution data
        const contributionsMap: Record<string, number> = {};
        conversationData.forEach(row => {
          const date = new Date(row.start_time);
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          contributionsMap[key] = (contributionsMap[key] || 0) + 1;
        });

        const contributionsArray = Object.entries(contributionsMap).map(([dateStr, value]) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return {
            month,
            week: Math.floor(day / 7),
            day: new Date(year, month, day).getDay(),
            value: Math.min(4, value)
          };
        });
        setContributionData(contributionsArray);

        // Load time patterns data
        const timePatternsResponse = await fetch('/api/time-patterns');
        const timePatterns = await timePatternsResponse.json();
        const hourlyPatterns: {hour: string; count: number}[] = Object.entries(timePatterns.hourly_pattern).map(([hour, count]) => ({
          hour: `${hour}:00`,
          count: count as number
        }));
        setHourlyData(hourlyPatterns);

        // Load seasonal data
        const seasonNames = ["春·新生", "夏·蝉鸣", "秋·收获", "冬·沉思"];
        const seasonalPatterns: {name: string; value: number}[] = Object.entries(timePatterns.seasonal_pattern).map(([season, value]) => ({
          name: seasonNames[Number(season) - 1],
          value: value as number
        }));
        setSeasonalData(seasonalPatterns);

        // Load cluster summaries data
        const clusterResponse = await fetch('/api/cluster-summaries');
        const clusterData = await clusterResponse.json() as Record<string, {cluster: string; nums: number}>;
        const topics = Object.entries(clusterData)
          .filter(([key]) => key !== '-1')
          .map(([, value]) => ({
            name: value.cluster,
            value: value.nums
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setTopTopics(topics);

        // Load duration stats
        const durationStatsResponse = await fetch('/api/duration-stats');
        const durationStats = await durationStatsResponse.json();
        setStats({
          totalDuration: durationStats.total_duration,
          avgDuration: durationStats.average_duration,
          longestChat: {
            duration: durationStats.longest_chat.duration,
            name: durationStats.longest_chat.name
          }
        });

        // Load token stats
        const tokenStatsRes = await fetch('/api/token-stats');
        const tokenStatsData = await tokenStatsRes.json();
        setTokenStats(tokenStatsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    console.log('Current stats:', stats);  // 添加调试日志
  }, [stats]);

  const COLORS = ['#818CF8', '#A78BFA', '#F472B6', '#FB923C'];

  const parseHours = (timeStr: string) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    
    setIsExporting(true);
    try {
      // 等待一小段时间确保字体加载完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#F9FAFB',
        onclone: (document) => {
          // 确保字体在导出时已加载
          const style = document.createElement('style');
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&display=swap');
          `;
          document.head.appendChild(style);
        }
      });
      
      // 使用北京时区格式化日期
      const beijingTime = toZonedTime(new Date(), 'Asia/Shanghai');
      const formattedDate = format(beijingTime, 'yyyy年MM月dd日');
      
      const link = document.createElement('a');
      link.download = `Claude年度总结-${formattedDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const NumberDisplay = ({ value }: { value: number }) => (
    <span className="number-font" style={{
      display: 'inline-block',
      padding: '0 0.25rem',
      fontWeight: 'bold',
      fontSize: '1.1em'
    }}>
      {value % 1 === 0 ? value.toString() : value.toFixed(1)}
    </span>
  );

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-12"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl shadow-xl p-6 h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] p-4 md:p-8">
      <div ref={dashboardRef} className="max-w-7xl mx-auto">
        {/* Header section */}
        <div className="max-w-7xl mx-auto mb-16 text-center">
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20 animate-pulse-soft"></div>
            <h1 className="relative text-5xl md:text-6xl font-bold gradient-text mb-6 tracking-tight">
              相遥相知
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            在这<NumberDisplay value={parseHours(stats.totalDuration)} />小时的相伴里，
            我们织就了无数个故事。每一次交谈都像一场静好的约会，平均持续
            <NumberDisplay value={parseHours(stats.avgDuration)} />小时，
            细细品味着时光的芬芳。
          </p>
        </div>

        {/* Stats cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-card rounded-2xl p-6 hover-lift group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                ✨
              </div>
              <h3 className="text-sm font-medium text-gray-500">最深刻的对话</h3>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              花了<NumberDisplay value={parseHours(stats.longestChat.duration)} />小时，
              终于解决了{stats.longestChat.name}这个问题
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6 hover-lift group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                🌟
              </div>
              <h3 className="text-sm font-medium text-gray-500">最活跃的时刻</h3>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {(() => {
                const maxHourData = hourlyData.reduce((max, curr) =>
                  (curr.count > (max?.count || 0)) ? curr : max
                , hourlyData[0] || { hour: '00:00', count: 0 });

                const hour = parseInt(maxHourData.hour);
                let timeDesc = '';
                if (hour >= 5 && hour < 12) {
                  timeDesc = '晨光熹微';
                } else if (hour >= 12 && hour < 14) {
                  timeDesc = '正午时分';
                } else if (hour >= 14 && hour < 18) {
                  timeDesc = '午后时光';
                } else if (hour >= 18 && hour < 22) {
                  timeDesc = '日暮时分';
                } else if (hour >= 22 || hour < 5) {
                  timeDesc = '深夜时分';
                }

                return `${timeDesc}的灵感迸发，陪伴了 `
              })()}
              <NumberDisplay value={hourlyData.reduce((max, curr) =>
                Math.max(max, curr.count), 0)
              } />
              次对话
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6 hover-lift group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                ❄️
              </div>
              <h3 className="text-sm font-medium text-gray-500">最丰富的季节</h3>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              冬日暖阳下，共度了
              <NumberDisplay
                value={seasonalData.reduce((max, curr) => curr.value > max.value ? curr : max, { value: 0 })?.value || 0}
              />
              个温馨时光
            </p>
          </div>
        </div>

        {/* Tokens Stats Card */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="glass-card rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              <span className="gradient-text">思维的痕迹</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-gray-500 mb-1">输入的文字</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                  {formatNumber(tokenStats.input_tokens)}
                </div>
                <div className="text-sm text-gray-400 mt-1">tokens</div>
              </div>
              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-gray-500 mb-1">回应的智慧</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
                  {formatNumber(tokenStats.output_tokens)}
                </div>
                <div className="text-sm text-gray-400 mt-1">tokens</div>
              </div>
              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-gray-500 mb-1">总计交流</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">
                  {formatNumber(tokenStats.total_tokens)}
                </div>
                <div className="text-sm text-gray-400 mt-1">tokens</div>
              </div>
            </div>
          </div>
        </div>

        {/* GitHub style heatmap */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              <span className="gradient-text">岁月的印记</span>
            </h2>
            <p className="text-gray-600 mb-6">这一年里，我们的对话如何在时光中起起落落？让数字勾勒出我们相聚的痕迹。</p>

            <div style={{ height: '200px' }}>
              <ResponsiveCalendar
                data={contributionData.map(d => ({
                  day: `2024-${String(d.month + 1).padStart(2, '0')}-${String(d.week * 7 + d.day + 1).padStart(2, '0')}`,
                  value: d.value
                }))}
                from="2024-01-01"
                to="2024-12-31"
                emptyColor="#f1f5f9"
                colors={['#C7D2FE', '#818CF8', '#6366F1', '#4F46E5']}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                yearSpacing={40}
                monthBorderColor="#ffffff"
                dayBorderWidth={2}
                dayBorderColor="#ffffff"
                legends={[
                  {
                    anchor: 'bottom-right',
                    direction: 'row',
                    translateY: 36,
                    itemCount: 4,
                    itemWidth: 42,
                    itemHeight: 36,
                    itemsSpacing: 14,
                    itemDirection: 'right-to-left'
                  }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Charts section */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Hourly distribution */}
          <div className="glass-card rounded-2xl p-6 hover-lift">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              <span className="gradient-text">昼夜轮转</span>
            </h2>
            <p className="text-gray-600 mb-6">当晨曦初露，当夜幕低垂，看看在一天的哪个时刻，我们最爱驻足交谈。</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...hourlyData].sort((a, b) => parseInt(a.hour) - parseInt(b.hour))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="count" fill="url(#hourlyGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#C4B5FD" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seasonal distribution */}
          <div className="glass-card rounded-2xl p-6 hover-lift">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              <span className="gradient-text">春夏秋冬</span>
            </h2>
            <p className="text-gray-600 mb-6">四季更迭间，对话如何随着花开叶落、雪融冰消而变换韵律？</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={seasonalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}`}
                    labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                  >
                    {seasonalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hot Topics section */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              <span className="gradient-text">心之所向</span>
            </h2>
            <p className="text-gray-600 mb-6">在千言万语中，这五个话题最令我们驻足流连，让我们一同回味那些热切的分享。</p>
            <div className="space-y-6">
              {topTopics.map((topic, index) => (
                <div key={index} className="relative group">
                  <div className="flex items-baseline mb-2">
                    <span className="text-sm text-gray-500 mr-3 font-medium">{index + 1}.</span>
                    <span className="text-base font-medium text-gray-800">{topic.name}</span>
                    <span className="ml-auto text-sm text-gray-500">{topic.value}次</span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500 transition-all duration-500"
                      style={{
                        width: `${(topic.value / topTopics[0].value) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export button */}
      <div className="max-w-7xl mx-auto mt-8 flex justify-center">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`
            px-8 py-4 rounded-full font-medium text-white text-lg
            shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
            transition-all duration-300
            ${isExporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600'
            }
          `}
        >
          {isExporting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              正在导出...
            </span>
          ) : (
            '导出你的年度回忆'
          )}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;