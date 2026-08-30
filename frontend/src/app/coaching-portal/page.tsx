'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import coachingApi from '@/lib/coachingApi';

interface Patient {
  authorization_id: number;
  member: { id: number; name: string; avatar: string | null };
  authorized_at: string | null;
}

export default function CoachingPortalDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coachingApi.get('/patients').then(res => setPatients(res.data.patients ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="font-display text-h1 font-bold text-content-primary mb-1">Your Patients</h1>
      <p className="text-sm text-content-tertiary mb-6">Read-only coaching data — workouts, nutrition adherence, and body-stat trends.</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
      ) : patients.length === 0 ? (
        <EmptyState
          icon="user-check"
          title="No patients yet"
          description="Patients appear here once a member authorizes you and you accept the invite."
        />
      ) : (
        <div className="space-y-2">
          {patients.map(p => (
            <Link key={p.authorization_id} href={`/coaching-portal/patients/${p.authorization_id}`}>
              <Card className="hover:border-border-strong transition-colors">
                <div className="p-4 flex items-center gap-3">
                  {p.member.avatar ? (
                    <img src={p.member.avatar} alt={p.member.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-accent font-bold">
                      {p.member.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-content-primary truncate">{p.member.name}</p>
                    {p.authorized_at && (
                      <p className="text-xs text-content-tertiary">Authorized {new Date(p.authorized_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-content-tertiary shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
