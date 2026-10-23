import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout, PublicHeader, Footer, Protected } from './components/Layout';
import { OfflineBanner, Skeleton } from './components/UI';
import Landing from './pages/Landing';
import AuthPage, {VerifyEmail} from './pages/Auth';
const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Machines=lazy(()=>import('./pages/Machines'));
const Wallet=lazy(()=>import('./pages/Wallet'));
const Transactions=lazy(()=>import('./pages/Transactions'));
const Referrals=lazy(()=>import('./pages/Referrals'));
const Profile=lazy(()=>import('./pages/Profile'));
const Notifications=lazy(()=>import('./pages/Notifications'));
const Support=lazy(()=>import('./pages/Support'));
const Legal=lazy(()=>import('./pages/Legal'));
const Help=lazy(()=>import('./pages/Help'));
const Admin=lazy(()=>import('./pages/Admin'));
const NotFound=lazy(()=>import('./pages/NotFound'));
function ScrollReset(){const {pathname}=useLocation();useEffect(()=>{window.scrollTo(0,0);},[pathname]);return null;}
export default function App(){return <><ScrollReset/><OfflineBanner/><Suspense fallback={<main className="container loading-page"><Skeleton lines={6}/></main>}><Routes>
<Route path="/" element={<Landing/>}/>
{(['login','register','forgot-password','reset-password'] as const).map(mode=><Route key={mode} path={`/${mode}`} element={<AuthPage mode={mode}/>}/>)}
<Route path="/verify-email" element={<VerifyEmail/>}/>
<Route path="/legal/:document" element={<><PublicHeader/><Legal/><Footer/></>}/>
<Route path="/help" element={<><PublicHeader/><Help/><Footer/></>}/>
<Route element={<Protected/>}><Route element={<AppLayout/>}>
<Route path="/dashboard" element={<Dashboard/>}/><Route path="/machines" element={<Machines/>}/><Route path="/wallet" element={<Wallet/>}/><Route path="/transactions" element={<Transactions/>}/><Route path="/referrals" element={<Referrals/>}/><Route path="/profile" element={<Profile/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/support" element={<Support/>}/>
<Route element={<Protected admin/>}><Route path="/admin" element={<Admin/>}/></Route>
</Route></Route><Route path="*" element={<NotFound/>}/>
</Routes></Suspense></>; }
