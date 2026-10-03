/**
 * @file PatientDetailPopup.jsx
 * The one patient popup used everywhere a patient is clicked. Tabs: Overview (clinical info, care team,
 * today's schedule, requests), Treatment Journey (day by day) and Generate Report (doctor + admin).
 * No clinical values are shown: only event names and statuses.
 */

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ClipboardList,
  Route,
  FileText,
  Phone,
  Download,
  Share2,
  Plus,
  Loader2,
  HeartPulse,
  ShieldAlert,
  Wind,
  Scissors,
  Check,
  RefreshCw,
} from 'lucide-react';
import { FlowModal, FlowError, FlowSkeleton } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import RequestForm from './RequestForm.jsx';
import PatientReportSheet, { printReport } from './PatientReportSheet.jsx';
import { TabBar, AcuityBadge, Avatar, Field, TimelineList, ProgressLine, EventIcon, MiniEmpty, Chip, PanelTitle } from './CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { clock, shortDate, timeAgo, displayName } from '../../utils/flowFormat.js';

const REQ_TONE = { urgent: '#EF4444', high: '#F59E0B', medium: '#014BAA', low: '#94A3B8' };

function Header({ profile }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-bold text-ink-900">{profile.name ? `${profile.name} · ${profile.alias}` : profile.alias}</h2>
        <span className="text-xs text-ink-500">
          {profile.age} y · {profile.gender} · Blood {profile.bloodGroup}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={profile.critical && profile.status === 'admitted' ? 'critical' : profile.status} />
        <AcuityBadge level={profile.acuity} />
        <span className="text-[11px] text-ink-500">
          Admitted {shortDate(profile.admittedAt)} · <b className="text-ink-900">Day {profile.daysAdmitted}</b>
        </span>
        <span className="text-[11px] text-ink-500">
          {profile.doctor.name}
          {profile.doctor.specialty ? `, ${profile.doctor.specialty}` : ''}
        </span>
      </div>
    </div>
  );
}

function Overview({ data, canRequest, requester, onChanged }) {
  const { profile, schedule, requests } = data;
  const [showForm, setShowForm] = useState(false);
  const req = profile.requires;
  const chips = [
    req.icu && ['ICU', HeartPulse, '#EF4444'],
    req.isolation && ['Isolation', ShieldAlert, '#F59E0B'],
    req.ventilator && ['Ventilator', Wind, '#8B5CF6'],
    req.ot && ['OT', Scissors, '#014BAA'],
  ].filter(Boolean);
  const remaining = schedule.filter((s) => s.status !== 'done');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="flow-card p-3.5">
          <PanelTitle>Clinical info</PanelTitle>
          <Field label="Diagnosis">{profile.diagnosis}</Field>
          <Field label="Current status">
            <StatusPill status={profile.status} size="xs" />
          </Field>
          <Field label="Requires">
            {chips.length ? (
              <span className="flex flex-wrap justify-end gap-1">
                {chips.map(([l, I, c]) => (
                  <Chip key={l} icon={I} color={c}>
                    {l}
                  </Chip>
                ))}
              </span>
            ) : (
              'None'
            )}
          </Field>
          <Field label="Bed">{profile.bed ? `${profile.bed.id} · ${profile.bed.ward} · Floor ${profile.bed.floor}` : 'Not assigned'}</Field>
          <Field label="Admission type">{profile.admissionType}</Field>
        </section>

        <section className="flow-card p-3.5">
          <PanelTitle>Care team</PanelTitle>
          <div className="flex items-center gap-2.5 py-1.5">
            <Avatar name={profile.doctor.name} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-900 truncate">{profile.doctor.name}</p>
              <p className="text-[11px] text-ink-500 truncate">{profile.doctor.specialty || 'Primary doctor'}</p>
              {profile.doctor.phone && (
                <p className="text-[11px] text-ink-500 inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" aria-hidden="true" /> {profile.doctor.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 py-1.5 border-t border-cream-200">
            <Avatar name={profile.nurse?.name || 'N A'} color="#BE185D" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-900 truncate">{profile.nurse?.name || 'No nurse assigned'}</p>
              <p className="text-[11px] text-ink-500">{profile.nurse ? `Shift ${profile.nurse.shift}` : 'Assigned nurse'}</p>
            </div>
          </div>
          {profile.otSurgeon && (
            <div className="flex items-center gap-2.5 py-1.5 border-t border-cream-200">
              <Avatar name={profile.otSurgeon} color="#6D28D9" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-900 truncate">{profile.otSurgeon}</p>
                <p className="text-[11px] text-ink-500">OT surgeon</p>
              </div>
            </div>
          )}
        </section>

        <section className="flow-card p-3.5">
          <PanelTitle count={remaining.length}>Today&apos;s schedule</PanelTitle>
          <TimelineList items={remaining} emptyText="All done for today" />
        </section>
      </div>

      <section className="flow-card p-3.5">
        <PanelTitle
          count={requests.length}
          action={
            canRequest &&
            !showForm && (
              <button type="button" className="flow-btn-secondary !py-1.5" onClick={() => setShowForm(true)}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New Request
              </button>
            )
          }
        >
          Requests
        </PanelTitle>
        {showForm && (
          <div className="mb-3 rounded-lg border border-cream-200 bg-sunken/50 p-3">
            <RequestForm
              patientId={profile.patientId}
              alias={profile.alias}
              createdBy={requester}
              compact
              onSent={() => {
                setShowForm(false);
                onChanged();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
        {requests.length ? (
          <ul>
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 border-b border-cream-200 last:border-0">
                <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: REQ_TONE[r.priority] || '#94A3B8' }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-ink-900 truncate">{r.typeLabel}</span>
                  <span className="block text-[11px] text-ink-500 truncate">
                    {r.note || 'No note'} · {r.createdBy} · {timeAgo(r.createdAt)}
                  </span>
                </span>
                <span className="text-[10px] uppercase font-semibold text-ink-500">{r.priority}</span>
                <StatusPill status={r.status} size="xs" />
              </li>
            ))}
          </ul>
        ) : (
          <MiniEmpty text="No requests for this patient" />
        )}
      </section>
    </div>
  );
}

export function JourneyDays({ profile, journey }) {
  const est = Math.max(profile.estimatedStayDays || profile.daysAdmitted, profile.daysAdmitted);
  const pct = (profile.daysAdmitted / est) * 100;
  return (
    <div className="space-y-4">
      <div className="flow-card p-3.5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-ink-900">
            Day {profile.daysAdmitted} of estimated {est} day treatment
          </span>
          <span className="text-ink-500 tabular-nums">{Math.round(pct)}%</span>
        </div>
        <ProgressLine value={pct} label="Treatment progress" />
      </div>
      {journey.map((d) => (
        <section key={d.day}>
          <h4 className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-ink-900">Day {d.day}</span>
            <span className="text-[11px] text-ink-500">{shortDate(d.date)}</span>
            <span className="flex-1 h-px bg-cream-200" aria-hidden="true" />
          </h4>
          <ol className="relative ml-1.5 border-l border-cream-200 space-y-0.5">
            {d.events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative pl-4 py-1.5">
                <span className="absolute -left-[5px] top-[11px] w-2.5 h-2.5 rounded-full border-2 border-cream-50 bg-royal-500" aria-hidden="true" />
                <div className="flex items-start gap-2">
                  <span className="text-[11px] font-semibold tabular-nums text-ink-500 w-10 shrink-0">{clock(e.at)}</span>
                  <EventIcon type={e.type} className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs text-ink-900">{e.description}</span>
                    {e.by && <span className="block text-[11px] text-ink-500">{e.by}</span>}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ReportTab({ patientId, author }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);

  const generate = useCallback(async () => {
    setError(null);
    setReport(null);
    try {
      setReport(await careApi.generateReport(patientId, { by: author }));
    } catch (e) {
      setError(errorText(e, 'Could not generate the report'));
    }
  }, [patientId, author]);

  useEffect(() => {
    generate();
  }, [generate]);

  const share = async () => {
    setSharing(true);
    try {
      const r = await careApi.shareReport(report.id);
      setReport(r);
      toast.success('Report shared with the patient');
    } catch (e) {
      toast.error(errorText(e, 'Could not share the report'));
    } finally {
      setSharing(false);
    }
  };

  if (error) return <FlowError message={error} onRetry={generate} />;
  if (!report) return <FlowSkeleton lines={8} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2 no-print">
        <button type="button" className="flow-btn-ghost" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Regenerate
        </button>
        <button type="button" className="flow-btn-secondary" onClick={printReport}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download PDF
        </button>
        <button type="button" className="flow-btn-primary" onClick={share} disabled={sharing || report.shared}>
          {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : report.shared ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {report.shared ? 'Shared with Patient' : 'Share with Patient'}
        </button>
      </div>
      <PatientReportSheet report={report} />
    </div>
  );
}

/**
 * @param {{ patientId: string|null, bedInfo?: object, onClose: Function, footer?: React.ReactNode, onChanged?: Function, initialTab?: string }} props
 */
export function PatientDetailPopup({ patientId, bedInfo = null, onClose, footer = null, onChanged, initialTab = 'overview' }) {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const canReport = role === 'admin' || role === 'doctor';
  const canRequest = role === 'admin' || role === 'doctor' || role === 'nurse';

  const load = useCallback(async () => {
    if (!patientId) return;
    setError(null);
    try {
      setData(await careApi.getPatientDetail(patientId));
    } catch (e) {
      setError(errorText(e, 'Could not load the patient'));
    }
  }, [patientId]);

  useEffect(() => {
    setData(null);
    setTab(initialTab);
    load();
  }, [load, initialTab]);

  if (!patientId) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ClipboardList },
    { id: 'journey', label: 'Treatment Journey', icon: Route },
    ...(canReport ? [{ id: 'report', label: 'Generate Report', icon: FileText }] : []),
  ];

  return (
    <FlowModal
      open
      onClose={onClose}
      size="detail"
      title={data?.profile?.alias || bedInfo?.patientAlias || 'Patient'}
      header={data ? <Header profile={data.profile} /> : <p className="text-sm font-bold text-ink-900">{bedInfo?.patientAlias || 'Patient'}{bedInfo?.id ? ` · ${bedInfo.id}` : ''}</p>}
      footer={footer}
    >
      {error && <FlowError message={error} onRetry={load} />}
      {!data && !error && <FlowSkeleton lines={10} />}
      {data && (
        <div className="space-y-4">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          {tab === 'overview' && (
            <Overview
              data={data}
              canRequest={canRequest}
              requester={displayName(user)}
              onChanged={() => {
                load();
                onChanged?.();
              }}
            />
          )}
          {tab === 'journey' && <JourneyDays profile={data.profile} journey={data.journey} />}
          {tab === 'report' && canReport && <ReportTab patientId={patientId} author={displayName(user)} />}
        </div>
      )}
    </FlowModal>
  );
}

export default PatientDetailPopup;
