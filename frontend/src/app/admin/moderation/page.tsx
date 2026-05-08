'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { mockReportedContent } from '@/lib/mockData';
import { ChevronLeft, Shield, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';

export default function ModerationPage() {
  const [reports, setReports] = useState(mockReportedContent.map(r => ({ ...r })));

  const resolve = (id: string, action: 'approve' | 'remove') => {
    setReports(p => p.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'reviewed' : 'removed' } : r));
  };

  const pending = reports.filter(r => r.status === 'pending').length;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Content Moderation</h1>
            {pending > 0 && <p className="text-sm text-red-500">{pending} pending review{pending !== 1 ? 's' : ''}</p>}
          </div>
        </div>

        {pending > 0 && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 mb-5">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <div>
              <div className="font-semibold text-red-700 dark:text-red-400 text-sm">{pending} Reports Need Attention</div>
              <div className="text-xs text-red-600 dark:text-red-500">Review and take action on reported content</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {reports.map(report => (
            <div key={report.id} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={15} className={report.status === 'pending' ? 'text-red-500' : 'text-green-500'} />
                  <Badge variant={report.status === 'pending' ? 'red' : 'green'} size="sm">{report.status}</Badge>
                  <Badge variant="gray" size="sm">{report.type}</Badge>
                </div>
                <span className="text-xs text-gray-400">{report.date}</span>
              </div>

              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Reported Content</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                  &ldquo;{report.content}&rdquo;
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div>
                  <span className="text-gray-400">Reported by</span>
                  <div className="font-medium text-gray-900 dark:text-white">{report.reporter}</div>
                </div>
                <div>
                  <span className="text-gray-400">Reported user</span>
                  <div className="font-medium text-gray-900 dark:text-white">{report.reportedUser}</div>
                </div>
                <div>
                  <span className="text-gray-400">Reason</span>
                  <div className="font-medium text-red-500">{report.reason}</div>
                </div>
              </div>

              {report.status === 'pending' && (
                <div className="flex gap-2">
                  <Button onClick={() => resolve(report.id, 'approve')} variant="outline" size="sm" icon={<CheckCircle size={14} />} className="flex-1">
                    Approve (Keep)
                  </Button>
                  <Button onClick={() => resolve(report.id, 'remove')} variant="danger" size="sm" icon={<XCircle size={14} />} className="flex-1">
                    Remove Content
                  </Button>
                  <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:border-[#F87404]/40 hover:text-[#F87404] transition-colors shrink-0">
                    <Eye size={15} />
                  </button>
                </div>
              )}

              {report.status !== 'pending' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle size={14} />
                  <span>Reviewed — no action taken</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
