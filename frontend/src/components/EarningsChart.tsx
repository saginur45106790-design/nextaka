import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {api,money} from '../lib/api';
import {Empty,ErrorState,Skeleton} from './UI';
import {useLanguage} from '../lib/i18n';
type Point={day:string;amountMinor:string;count:string};
export default function EarningsChart(){const {t}=useLanguage();const q=useQuery({queryKey:['activity'],queryFn:()=>api<Point[]>('/activity')});if(q.isPending)return <Skeleton/>;if(q.error)return <ErrorState error={q.error}/>;if(!q.data?.length)return <Empty title={t('এখনো verified reward নেই','No verified rewards yet')}/>;
 const data=q.data.map(row=>({...row,displayAmount:Number(BigInt(row.amountMinor))/100}));
 return <><div className="chart-responsive" role="img" aria-label={t('যাচাইকৃত rewards-এর সাত দিনের chart','Seven-day verified rewards chart')}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#ffffff10" vertical={false}/><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip content={({active,payload})=>active&&payload?.[0]?<div className="glass panel"><strong>{payload[0].payload.day}</strong><p>{money(payload[0].payload.amountMinor)}</p></div>:null}/><Bar dataKey="displayAmount" fill="#63edba" radius={[5,5,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><p className="chart-footnote">{t('শুধু backend-এ credited settlement; ভবিষ্যৎ আয়ের পূর্বাভাস নয়।','Only backend-credited settlements, not a forecast.')}</p></>;
}
