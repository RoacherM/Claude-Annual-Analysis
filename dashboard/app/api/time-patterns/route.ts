/*
 * @Author: ByronVon
 * @Date: 2025-01-06 11:52:14
 * @FilePath: /ClaudeAnnualAnalysis/dashboard-demo/app/api/time-patterns/route.ts
 * @Description: 
 */
import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export async function GET() {
  try {
    // 使用北京时区
    const timeZone = 'Asia/Shanghai';
    
    // 生成24小时数据，使用北京时间
    const hourlyPattern: Record<string, number> = {};
    Array.from({ length: 24 }, (_, i) => {
      const hour = i;
      const beijingTime = format(
        toZonedTime(
          new Date(2025, 0, 1, hour),
          timeZone
        ),
        'HH'
      );
      hourlyPattern[beijingTime] = Math.floor(Math.random() * 100);
    });

    // 生成季节数据
    const seasonalPattern: Record<string, number> = {
      '1': Math.floor(Math.random() * 100),
      '2': Math.floor(Math.random() * 100),
      '3': Math.floor(Math.random() * 100),
      '4': Math.floor(Math.random() * 100),
    };

    return NextResponse.json({
      hourly_pattern: hourlyPattern,
      seasonal_pattern: seasonalPattern
    });
  } catch (error) {
    console.error('Error generating time patterns:', error);
    return NextResponse.json(
      { error: 'Failed to generate time patterns' },
      { status: 500 }
    );
  }
}
