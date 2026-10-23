import { Component, type ReactNode, type ErrorInfo } from 'react';
export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(_error:Error,_info:ErrorInfo){ /* Sensitive user state is never sent to third-party telemetry. */ }
 render(){return this.state.failed?<main className="container loading-page"><h1>পৃষ্ঠাটি খোলা যায়নি / Unable to open this page</h1><p>আবার খুলুন। সমস্যা থাকলে support-এ যোগাযোগ করুন।</p><button className="button" onClick={()=>window.location.reload()}>Reload</button></main>:this.props.children;}
}
