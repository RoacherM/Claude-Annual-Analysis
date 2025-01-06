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
import { zonedTimeToUtc, toZonedTime } from 'date-fns-tz';

const Dashboard = () => {
  const [contributionData, setContributionData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [topTopics, setTopTopics] = useState([]);
  const [seasonalData, setSeasonalData] = useState([]);
  const [stats, setStats] = useState<any>({
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
        }).data;

        // Generate contribution data
        const contributionsMap = {};
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
        const hourlyPatterns = Object.entries(timePatterns.hourly_pattern).map(([hour, count]) => ({
          hour: `${hour}:00`,
          count
        }));
        setHourlyData(hourlyPatterns);

        // Load seasonal data
        const seasonNames = ["春·新生", "夏·蝉鸣", "秋·收获", "冬·沉思"];
        const seasonalPatterns = Object.entries(timePatterns.seasonal_pattern).map(([season, value]) => ({
          name: seasonNames[Number(season) - 1],
          value
        }));
        setSeasonalData(seasonalPatterns);

        // Load cluster summaries data
        const clusterResponse = await fetch('/api/cluster-summaries');
        const clusterData = await clusterResponse.json();
        const topics = Object.entries(clusterData)
          .filter(([key]) => key !== '-1')
          .map(([_, value]) => ({
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

  const COLORS = ['#60A5FA', '#4ADE80', '#FBBF24', '#FB7185'];  // 更鲜艳的颜色

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
    <span style={{
      display: 'inline-block',
      padding: '0 0.25rem',
      color: '#2563EB',
      fontFamily: 'JetBrains Mono, monospace',
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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-12"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div ref={dashboardRef}>
        {/* Header section */}
        <div className="max-w-7xl mx-auto mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">相遥相知</h1>
          <p className="text-lg text-gray-700">
            在这<NumberDisplay value={parseHours(stats.totalDuration)} />小时的相伴里，
            我们织就了无数个故事。每一次交谈都像一场静好的约会，平均持续
            <NumberDisplay value={parseHours(stats.avgDuration)} />小时，
            细细品味着时光的芬芳。
          </p>
        </div>

        {/* Stats cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">最深刻的对话</h3>
            <p className="text-lg font-semibold mt-2 text-gray-900">
              花了<NumberDisplay value={parseHours(stats.longestChat.duration)} />小时，
              终于解决了{stats.longestChat.name}这个问题
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">最活跃的时刻</h3>
            <p className="text-lg font-semibold mt-2 text-gray-900">
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">最丰富的季节</h3>
            <p className="text-lg font-semibold mt-2 text-gray-900">
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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">思维的痕迹</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500 mb-1">输入的文字</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(tokenStats.input_tokens)}
                </div>
                <div className="text-sm text-gray-500">tokens</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500 mb-1">回应的智慧</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {formatNumber(tokenStats.output_tokens)}
                </div>
                <div className="text-sm text-gray-500">tokens</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500 mb-1">总计交流</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatNumber(tokenStats.total_tokens)}
                </div>
                <div className="text-sm text-gray-500">tokens</div>
              </div>
            </div>
          </div>
        </div>

        {/* GitHub style heatmap */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">岁月的印记</h2>
            <p className="text-sm text-gray-600 mb-6">这一年里，我们的对话如何在时光中起起落落？让数字勾勒出我们相聚的痕迹。</p>
            
            <div style={{ height: '200px' }}>
              <ResponsiveCalendar
                data={contributionData.map(d => ({
                  day: `2024-${String(d.month + 1).padStart(2, '0')}-${String(d.week * 7 + d.day + 1).padStart(2, '0')}`,
                  value: d.value
                }))}
                from="2024-01-01"
                to="2024-12-31"
                emptyColor="#f3f4f6"
                colors={['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB']}
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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">昼夜轮转</h2>
            <p className="text-sm text-gray-600 mb-6">当晨曦初露，当夜幕低垂，看看在一天的哪个时刻，我们最爱驻足交谈。</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...hourlyData].sort((a, b) => parseInt(a.hour) - parseInt(b.hour))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#4B5563" />
                  <YAxis stroke="#4B5563" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.375rem'
                    }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seasonal distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">春夏秋冬</h2>
            <p className="text-sm text-gray-600 mb-6">四季更迭间，对话如何随着花开叶落、雪融冰消而变换韵律？</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={seasonalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {seasonalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.375rem'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hot Topics section */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">心之所向</h2>
            <p className="text-sm text-gray-600 mb-6">在千言万语中，这五个话题最令我们驻足流连，让我们一同回味那些热切的分享。</p>
            <div className="space-y-8">
              {topTopics.map((topic, index) => (
                <div key={index} className="relative">
                  <div className="flex items-baseline mb-1">
                    <span className="text-sm text-gray-600 mr-2">{index + 1}.</span>
                    <span className="text-base font-medium text-gray-800">{topic.name}</span>
                    <span className="ml-auto text-sm text-gray-600">{topic.value}次</span>
                  </div>
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full" 
                    style={{ 
                      width: `${(topic.value / topTopics[0].value) * 100}%`,
                      transition: 'width 0.5s ease-in-out'
                    }}
                  />
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
            px-6 py-3 rounded-lg font-medium text-white
            transition-all duration-200
            ${isExporting 
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {isExporting ? '正在导出...' : '导出你的年度回忆'}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;