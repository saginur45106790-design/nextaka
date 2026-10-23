import { Link } from 'react-router-dom';
import { useLanguage } from '../lib/i18n';
export default function NotFound(){const {t}=useLanguage();return <main className="container loading-page"><span className="eyebrow">404 / NEXTAKA</span><h1>{t('পৃষ্ঠাটি পাওয়া যায়নি','Page not found')}</h1><Link className="button" to="/">{t('হোমে ফিরুন','Return home')}</Link></main>;}
