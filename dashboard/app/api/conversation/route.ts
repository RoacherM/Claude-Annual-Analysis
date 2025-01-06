/*
 * @Author: ByronVon
 * @Date: 2025-01-06 11:52:23
 * @FilePath: /ClaudeAnnualAnalysis/dashboard-demo/app/api/conversation/route.ts
 * @Description: 
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), '../out/conversation.csv');
    const fileContents = await fs.promises.readFile(filePath, 'utf8');
    
    return new NextResponse(fileContents, {
      headers: {
        'Content-Type': 'text/csv',
      },
    });
  } catch (error) {
    console.error('Error reading conversation data:', error);
    return NextResponse.json({ error: 'Failed to load conversation data' }, { status: 500 });
  }
}
