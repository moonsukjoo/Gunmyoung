import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Radio, 
  Plus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  CheckCircle2, 
  Waves,
  MapPin,
  ArrowRight,
  Battery,
  User,
  History,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Beacon {
  id: string;
  docId: string;
  name: string;
  submarineName: string;
  location: string;
  order: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  batteryLevel: number;
  lastSeenAt?: string;
  createdAt: string;
}

interface BeaconLog {
  id: string;
  beaconId: string;
  beaconLocation: string;
  uid: string;
  userName: string;
  rssi: number;
  detectedAt: string;
}

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

const PCAdminBeacons: React.FC = () => {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [logs, setLogs] = useState<BeaconLog[]>([]);
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'rules' | 'monitoring'>('infrastructure');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBeacon, setNewBeacon] = useState({
    id: '',
    name: '',
    submarineName: '',
    location: '',
    order: 1
  });

  const [rules, setRules] = useState([
    { id: 1, name: '장기 체류 알림', description: '동일 지점 30분 이상 체류 시 관리자 호출', enabled: true, threshold: 30, unit: 'min' },
    { id: 2, name: '심박수/자세 동시 모니터링', description: '비콘 신호와 스마트워치 생체 데이터 연동', enabled: true },
    { id: 3, name: '비정상 경로 진입', description: '설정된 순서 외 비정상 진입 시 경보', enabled: false },
    { id: 4, name: '배터리 부족 알림', description: '비콘 배터리 10% 미만 시 교체 알림', enabled: true, threshold: 10, unit: '%' },
  ]);

  useEffect(() => {
    const q = query(collection(db, 'beacons'), orderBy('submarineName'), orderBy('order'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Beacon));
      setBeacons(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beacons');
    });

    const lq = query(collection(db, 'beaconLogs'), orderBy('detectedAt', 'desc'));
    const unsubscribeLogs = onSnapshot(lq, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as BeaconLog)).slice(0, 50);
      setLogs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beaconLogs');
    });

    return () => {
      unsubscribe();
      unsubscribeLogs();
    };
  }, []);

  const handleAddBeacon = async () => {
    if (!newBeacon.id || !newBeacon.submarineName || !newBeacon.location) {
      toast.error('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'beacons'), {
        ...newBeacon,
        status: 'ACTIVE',
        batteryLevel: 100,
        createdAt: new Date().toISOString()
      });
      toast.success('비콘이 성공적으로 등록되었습니다.');
      setShowAddModal(false);
      setNewBeacon({ id: '', name: '', submarineName: '', location: '', order: beacons.length + 1 });
    } catch (e) {
      console.error(e);
      toast.error('비콘 등록 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteBeacon = async (docId: string) => {
    if (!window.confirm('이 비콘을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'beacons', docId));
      toast.success('비콘이 삭제되었습니다.');
    } catch (e) {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // Group beacons by submarine
  const groupedBeacons = beacons.reduce((acc, beacon) => {
    if (!acc[beacon.submarineName]) acc[beacon.submarineName] = [];
    acc[beacon.submarineName].push(beacon);
    return acc;
  }, {} as Record<string, Beacon[]>);

  return (
    <PCAdminLayout title="밀폐공간 위치관제 (비콘 관리)">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">스마트 비콘 시스템 설정</h2>
            <p className="text-slate-500 font-medium text-lg">잠수함 내부 밀폐공간 위치 추적을 위한 블루투스 비콘 인프라를 관리합니다.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('infrastructure')}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'infrastructure' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  비콘 인프라
                </button>
                <button 
                  onClick={() => setActiveTab('rules')}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'rules' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  안전 로직 설정
                </button>
                <button 
                  onClick={() => setActiveTab('monitoring')}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'monitoring' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  실시간 위치 관제
                </button>
            </div>
            {activeTab === 'infrastructure' && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                신규 비콘 등록
              </button>
            )}
          </div>
        </div>

        {activeTab === 'infrastructure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main List Area */}
            <div className="lg:col-span-2 space-y-8">
              {Object.keys(groupedBeacons).length === 0 ? (
                <div className="bg-white rounded-[3rem] p-20 border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">
                   <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 text-slate-300">
                      <Radio className="w-12 h-12" />
                   </div>
                   <h3 className="text-xl font-black text-slate-400">등록된 비콘이 없습니다.</h3>
                   <p className="text-slate-400 mt-2">입구부터 내부까지의 경로를 구성해 보세요.</p>
                </div>
              ) : (
                Object.entries(groupedBeacons).map(([submarine, submarineBeacons]) => (
                  <div key={submarine} className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <Waves className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">{submarine}</h3>
                        <p className="text-slate-400 font-bold">총 {submarineBeacons.length}개의 수집 지점</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {submarineBeacons.sort((a,b) => a.order - b.order).map((beacon, idx) => (
                        <div key={beacon.docId} className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-blue-200 hover:bg-blue-50/30 transition-all relative">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-200 shadow-sm group-hover:text-blue-600 group-hover:border-blue-200">
                            {beacon.order}
                          </div>
                          
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-8">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">위치명</p>
                              <p className="font-black text-slate-700 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-rose-500" />
                                {beacon.location}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">비콘 식별번호</p>
                              <p className="font-mono text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-100 w-fit">{beacon.id}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">상태</p>
                              <div className="flex items-center gap-2">
                                {beacon.status === 'ACTIVE' ? (
                                  <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 정상
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                    <AlertCircle className="w-3.5 h-3.5" /> 장애
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                               <Battery className={`w-5 h-5 ${beacon.batteryLevel < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
                               <span className="text-xs font-black text-slate-700">{beacon.batteryLevel}%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-3 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteBeacon(beacon.docId)}
                              className="p-3 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Visual Route Indicator */}
                    <div className="mt-10 p-6 bg-slate-900 rounded-3xl flex items-center gap-4 overflow-x-auto no-scrollbar shadow-2xl">
                      <span className="shrink-0 text-[10px] font-black text-blue-500 uppercase tracking-widest px-4 border-r border-slate-700">추적 경로</span>
                      {submarineBeacons.sort((a,b) => a.order - b.order).map((b, i) => (
                        <React.Fragment key={b.docId}>
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-white border border-slate-700">
                              {b.order}
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 mt-1 whitespace-nowrap">{b.location}</span>
                          </div>
                          {i < submarineBeacons.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Real-time Side Log Area */}
            <div className="space-y-8">
              <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col h-[800px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <History className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">수신 실시간 로그</h3>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar no-scrollbar">
                  {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <History className="w-10 h-10 text-slate-200 mb-4" />
                      <p className="text-sm font-bold text-slate-300">현재 감지된 신호가 없습니다.</p>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 relative overflow-hidden group hover:border-blue-200 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                               <User className="w-4 h-4 text-slate-400" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-800 leading-none">{log.userName}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{format(new Date(log.detectedAt), 'HH:mm:ss')}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">RSSI</p>
                             <p className="text-xs font-black text-blue-600">{log.rssi} dBm</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                           <MapPin className="w-3.5 h-3.5 text-rose-500" />
                           <span>{log.beaconLocation} 통과</span>
                        </div>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-0 group-hover:opacity-5 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* System Status Summary */}
              <div className="bg-slate-900 rounded-[3rem] p-8 text-white">
                 <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Network Status</h4>
                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-400">활성 비콘</span>
                      <span className="text-lg font-black">{beacons.filter(b => b.status === 'ACTIVE').length} Units</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-400">장애 발생</span>
                      <span className="text-lg font-black text-rose-500">{beacons.filter(b => b.status !== 'ACTIVE').length} Units</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-400">평균 배터리</span>
                      <span className="text-lg font-black text-emerald-400">
                        {beacons.length > 0 ? Math.round(beacons.reduce((a, b) => a + b.batteryLevel, 0) / beacons.length) : 0}%
                      </span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {rules.map(rule => (
               <div key={rule.id} className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-2xl font-black text-slate-900">{rule.name}</h3>
                      <button className={`w-14 h-8 rounded-full relative transition-all ${rule.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${rule.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-slate-500 font-bold text-lg mb-8">{rule.description}</p>
                    
                    {rule.threshold && (
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                         <span className="text-sm font-black text-slate-400 uppercase tracking-widest">임계값 설정</span>
                         <div className="flex items-center gap-3">
                            <input type="number" defaultValue={rule.threshold} className="w-20 bg-white border border-slate-200 px-4 py-2 rounded-xl text-right font-black" />
                            <span className="text-sm font-black text-slate-600">{rule.unit}</span>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4">
                     <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all">설정 저장</button>
                     <button className="px-6 py-4 border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all">
                        <Settings className="w-5 h-5" />
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-sm min-h-[600px] flex flex-col items-center justify-center text-center">
             <div className="w-32 h-32 bg-blue-50 rounded-[4rem] flex items-center justify-center mb-10 relative">
               <Waves className="w-16 h-16 text-blue-600 animate-pulse" />
               <div className="absolute inset-0 border-4 border-blue-200 rounded-[4rem] animate-ping opacity-20" />
             </div>
             <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-6">밀폐공간 실시간 모니터링 준비 중</h3>
             <p className="text-slate-500 font-medium text-xl max-w-2xl leading-relaxed">
               잠수함 내부의 비콘 신호를 수집하여 작업자의 현재 위치를 시각화합니다.<br/>
               설정된 비콘 위치 순서(Entrance → ... → Working Area)에 따라<br/>
               실시간 체류 현황을 대시보드에 표시합니다.
             </p>
             <div className="mt-12 flex gap-6">
                <div className="px-10 py-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">현재 작업 인원</p>
                   <p className="text-3xl font-black text-slate-900">12명</p>
                </div>
                <div className="px-10 py-6 bg-rose-50 rounded-[2rem] border border-rose-100">
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">위험 알림</p>
                   <p className="text-3xl font-black text-rose-600">0건</p>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 relative shadow-2xl overflow-hidden border border-white/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 -mr-32 -mt-32" />
            
            <div className="relative">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">비콘 신규 등록</h3>
              <p className="text-slate-400 font-bold mb-8">잠수함 내부의 특정 지점에 설치될 비콘 정보를 입력하세요.</p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">식별 번호 (Address)</label>
                    <input 
                      type="text" 
                      value={newBeacon.id}
                      onChange={(e) => setNewBeacon({...newBeacon, id: e.target.value})}
                      placeholder="e.g. B1:C2:D3:E4"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">비콘 이름</label>
                    <input 
                      type="text" 
                      value={newBeacon.name}
                      onChange={(e) => setNewBeacon({...newBeacon, name: e.target.value})}
                      placeholder="e.g. Entrance-01"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">함명 (Submarine Name)</label>
                  <input 
                    type="text" 
                    value={newBeacon.submarineName}
                    onChange={(e) => setNewBeacon({...newBeacon, submarineName: e.target.value})}
                    placeholder="e.g. 건명-701함"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">설치 위치</label>
                    <input 
                      type="text" 
                      value={newBeacon.location}
                      onChange={(e) => setNewBeacon({...newBeacon, location: e.target.value})}
                      placeholder="e.g. 입구 사다리"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">진입 순서 (Order)</label>
                    <input 
                      type="number" 
                      value={newBeacon.order}
                      onChange={(e) => setNewBeacon({...newBeacon, order: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                   <button 
                     onClick={() => setShowAddModal(false)}
                     className="flex-1 px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all border border-slate-200"
                   >
                     취소
                   </button>
                   <button 
                     onClick={handleAddBeacon}
                     className="flex-[2] px-8 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                   >
                     비콘 등록 완료
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminBeacons;
