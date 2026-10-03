/**
 * @file PatientReportSheet.jsx
 * Printable patient report (event names and statuses only, no clinical values) and a print helper
 * that sends just the sheet to the browser's "Save as PDF".
 */

import React from 'react';
import { shortDate } from '../../utils/flowFormat.js';

const STATUS_TEXT = { admitted: 'Admitted', in_surgery: 'In Surgery', in_recovery: 'In Recovery', discharged: 'Discharged', waiting: 'Waiting for bed' };

/** Print only the element with class "print-area" (the open report). */
export function printReport() {
  document.body.classList.add('printing-report');
  const done = () => {
    document.body.classList.remove('printing-report');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Some browsers do not fire afterprint reliably
  setTimeout(done, 1500);
}

function Section({ title, children }) {
  return (
    <section className="border-t border-slate-300 px-5 py-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{title}</h4>
      <div className="text-xs text-slate-900 space-y-1">{children}</div>
    </section>
  );
}

export function PatientReportSheet({ report }) {
  if (!report) return null;
  const c = report.content;
  return (
    <article className="print-area rounded-lg border border-slate-300 bg-white text-slate-900 font-sans overflow-hidden" aria-label="Patient medical report">
      <header className="px-5 py-4">
        <h3 className="text-sm font-extrabold tracking-wide">PATIENT MEDICAL REPORT</h3>
        <p className="text-[11px] text-slate-500">MediOrchestra Hospital System · Generated {shortDate(report.createdAt)} · {report.doctorName}</p>
      </header>
      <Section title="Patient">
        <p>
          <b>Patient:</b> {c.name ? `${c.name} (${c.alias})` : c.alias} &nbsp; <b>ID:</b> {c.alias}
        </p>
        <p>
          <b>Age:</b> {c.age} &nbsp;|&nbsp; <b>Gender:</b> {c.gender} &nbsp;|&nbsp; <b>Blood Group:</b> {c.bloodGroup}
        </p>
        <p>
          <b>Admitted:</b> {shortDate(c.admittedAt)} &nbsp;|&nbsp; <b>Days Admitted:</b> {c.daysAdmitted} {c.daysAdmitted === 1 ? 'day' : 'days'}
        </p>
      </Section>
      <Section title="Primary diagnosis">
        <p>{c.diagnosis}</p>
      </Section>
      <Section title="Treatment timeline">
        {c.timeline.map((d) => (
          <p key={d.day}>
            <b>Day {d.day}:</b> {d.events.join('; ')}
          </p>
        ))}
      </Section>
      <Section title="Care team">
        <p>
          <b>Doctor:</b> {c.careTeam.doctor}
        </p>
        <p>
          <b>Nurse:</b> {c.careTeam.nurse}
        </p>
      </Section>
      <Section title="Current status">
        <p>
          {STATUS_TEXT[c.status] || c.status} &nbsp;|&nbsp; Acuity {c.acuity}
        </p>
      </Section>
    </article>
  );
}

export default PatientReportSheet;
