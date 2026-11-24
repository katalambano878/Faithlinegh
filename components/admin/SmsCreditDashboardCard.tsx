import Link from 'next/link';
import type { DashboardSmsCredit } from '@/lib/sms-credit-types';

type Props = {
  smsCredit: DashboardSmsCredit;
  buySmsHref?: string;
};

export function SmsCreditDashboardCard({ smsCredit, buySmsHref }: Props) {
  const blinkLow = smsCredit.status === 'ok' && smsCredit.level === 'low';
  const blinkEmpty = smsCredit.status === 'ok' && smsCredit.level === 'empty';

  const borderClass =
    smsCredit.status === 'ok' && smsCredit.level === 'empty'
      ? 'border-[#A3392B]/35'
      : smsCredit.status === 'ok' && smsCredit.level === 'low'
        ? 'border-brand-brown/25'
        : 'border-gray-200';

  const iconBg =
    smsCredit.status === 'ok' && smsCredit.level === 'empty'
      ? 'bg-red-100 text-[#7A2A20]'
      : smsCredit.status === 'ok' && smsCredit.level === 'low'
        ? 'bg-brand-cream text-brand-brown'
        : 'bg-gray-100 text-gray-700';

  const showTopUp = Boolean(buySmsHref) && smsCredit.status !== 'not_connected';

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${borderClass} ${
        blinkEmpty ? 'sms-credit-double-blink-empty' : blinkLow ? 'sms-credit-double-blink' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-gray-900">SMS credit</h3>
        {showTopUp ? (
          <Link
            href={buySmsHref!}
            className="inline-flex items-center justify-center px-3 py-1.5 bg-brand-brown text-white text-xs font-semibold rounded-lg hover:bg-brand-bag-dark transition-colors shrink-0"
          >
            Top up
          </Link>
        ) : null}
      </div>

      {smsCredit.status === 'not_connected' ? (
        <p className="text-base font-semibold text-gray-800">SMS is not connected</p>
      ) : smsCredit.status === 'load_failed' ? (
        <p className="text-base font-semibold text-gray-800">The balance could not be loaded</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                smsCredit.level === 'empty' ? 'text-[#7A2A20]' : smsCredit.level === 'low' ? 'text-brand-brown' : 'text-gray-900'
              }`}
            >
              {smsCredit.sms_left.toLocaleString('en-GH')}
            </span>
            <span className="text-sm text-gray-500">texts left</span>
          </div>
          {smsCredit.level === 'low' ? (
            <p className="mt-2 text-sm font-medium text-brand-brown">Running low, top up soon</p>
          ) : null}
          {smsCredit.level === 'empty' ? (
            <p className="mt-2 text-sm font-medium text-[#7A2A20]">SMS credit is empty, texts are not being sent</p>
          ) : null}
        </>
      )}

      <div className={`w-11 h-11 mt-4 flex items-center justify-center rounded-lg ${iconBg}`} aria-hidden>
        <i className="ri-message-2-line text-2xl" />
      </div>
    </div>
  );
}