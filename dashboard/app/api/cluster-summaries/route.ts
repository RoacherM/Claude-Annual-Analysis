/*
 * @Author: ByronVon
 * @Date: 2025-01-06 11:52:08
 * @FilePath: /ClaudeAnnualAnalysis/dashboard-demo/app/api/cluster-summaries/route.ts
 * @Description: 
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), '../out/cluster_summaries.json');
    const fileContents = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading cluster summaries:', error);
    return NextResponse.json({ error: 'Failed to load cluster summaries' }, { status: 500 });
  }
}
