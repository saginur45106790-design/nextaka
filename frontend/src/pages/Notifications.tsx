import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { api,post,date } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { Empty,ErrorState,Heading,Skeleton } from '../components/UI';
type Notice={id:string;title:string;message:string;createdAt:string;readAt?:string};
export default function Notifications(){const {t}=useLanguage();const client=useQueryClient();const q=useQuery({queryKey:['notifications'],queryFn:()=>api<Notice[]>('/notifications')});const m=useMutation({mutationFn:(id:string)=>post(`/notifications/${id}/read`,{}),onSuccess:()=>{void client.invalidateQueries({queryKey:['notifications']});}});return <><Heading title={t('নোটিফিকেশন','Notifications')}/>{m.error&&<ErrorState error={m.error}/>} {q.isPending?<Skeleton/>:q.error?<ErrorState error={q.error}/>:q.data?.length?q.data.map(n=><article className="glass panel" key={n.id}><small>{date(n.createdAt)}</small><h2>{n.title}</h2><p>{n.message}</p>{!n.readAt&&<button className="button secondary" disabled={m.isPending} onClick={()=>m.mutate(n.id)}>{t('পড়া হয়েছে','Mark as read')}</button>}</article>):<Empty title={t('নতুন কোনো বার্তা নেই','No notifications')}/>}</>;}
