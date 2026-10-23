import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Share2 } from 'lucide-react';
import { api, date, money } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { Heading, Empty, ErrorState, Skeleton, Status, useConfig } from '../components/UI';

type ReferralData = {
  code: string;
  url: string;
  stats: {
    total: number;
    pending: number;
    qualified: number;
    earnedMinor: string;
  };
  items: {
    id: string;
    status: string;
    createdAt: string;
    commission?: { amountMinor: string } | null;
  }[];
};

export default function Referrals() {
  const { t } = useLanguage();
  const config = useConfig();
  const query = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api<ReferralData>('/referrals'),
  });
  const data = query.data;

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.url);
      toast.success(t('লিংক কপি হয়েছে', 'Link copied'));
    } catch {
      toast.error(t('কপি হয়নি। লিংক select করে কপি করুন।', 'Could not copy. Select and copy the link.'));
    }
  }

  async function share() {
    if (!data) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: 'NEXTAKA', url: data.url });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error(t('শেয়ার করা যায়নি। লিংক কপি করুন।', 'Unable to share. Copy the link instead.'));
    }
  }

  return (
    <>
      <Heading
        eyebrow="GROW RESPONSIBLY"
        title={t('আপনার রেফারেল', 'Your referrals')}
        description={t(
          'আমন্ত্রণ জানান। যোগ্যতা ও funding যাচাইয়ের পরেই কমিশন।',
          'Invite someone. Commissions require eligibility and funding review.',
        )}
      />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : data ? (
        <>
          <div className="glass panel">
            {config.isPending ? (
              <Skeleton lines={1} />
            ) : config.error ? (
              <ErrorState error={config.error} retry={() => void config.refetch()} />
            ) : config.data ? (
              <Status value={config.data.referral.enabled ? 'CAMPAIGN_ENABLED' : 'CAMPAIGN_PAUSED'} />
            ) : null}
            <h2>{data.code}</h2>
            <label className="field">
              <span>{t('রেফারেল লিংক', 'Referral URL')}</span>
              <input readOnly value={data.url} onFocus={(event) => event.target.select()} />
            </label>
            <div className="button-row">
              <button type="button" className="button" onClick={() => void copy()}>
                <Copy size={17} aria-hidden="true" />
                {t('কপি', 'Copy')}
              </button>
              <button type="button" className="button secondary" onClick={() => void share()}>
                <Share2 size={17} aria-hidden="true" />
                {t('শেয়ার', 'Share')}
              </button>
            </div>
          </div>
          <div className="stats-grid">
            {[
              { key: 'total', label: t('মোট', 'Total'), value: data.stats.total },
              { key: 'pending', label: t('অপেক্ষমাণ', 'Pending'), value: data.stats.pending },
              { key: 'qualified', label: t('যোগ্য', 'Qualified'), value: data.stats.qualified },
              {
                key: 'earned',
                label: t('অনুমোদিত কমিশন', 'Approved commissions'),
                value: money(data.stats.earnedMinor),
              },
            ].map((stat) => (
              <article className="glass stat-card" key={stat.key}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
          <section className="glass panel">
            <h2>{t('শর্তাবলি', 'Conditions')}</h2>
            <p>
              {t('প্রস্তাবিত কমিশন', 'Configured commission')}:{' '}
              {money(config.data?.referral.commissionMinor)}
              {' · '}
              {t('যোগ্য ডিপোজিট', 'Qualifying deposit')}:{' '}
              {money(config.data?.referral.thresholdMinor)}
            </p>
            <p>
              {t(
                'সত্যিকারের অনুমোদিত qualifying transaction, fraud review এবং স্বতন্ত্র marketing budget আবশ্যক। নতুন সদস্যের ভবিষ্যৎ deposit থেকে কমিশনের প্রতিশ্রুতি দেওয়া হয় না। নিজেকে referral করা বা একাধিকবার একই যোগ্যতা ব্যবহার নিষিদ্ধ।',
                'An approved qualifying transaction, fraud review and independently funded marketing budget are required. Commissions are not promised from future participant deposits. Self-referrals and repeated qualification are prohibited.',
              )}
            </p>
          </section>
          {data.items.length > 0 ? (
            <div className="record-list">
              {data.items.map((referral) => (
                <article className="glass record" key={referral.id}>
                  <Status value={referral.status} />
                  <p>{date(referral.createdAt)}</p>
                  <span>{money(referral.commission?.amountMinor)}</span>
                </article>
              ))}
            </div>
          ) : (
            <Empty title={t('এখনো কোনো referral নেই', 'No referrals yet')} />
          )}
        </>
      ) : (
        <Empty title={t('রেফারেলের তথ্য পাওয়া যায়নি', 'Referral data is unavailable')} />
      )}
    </>
  );
}
