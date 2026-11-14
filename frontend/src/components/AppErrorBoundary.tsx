import { Component, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="recovery-page"><h1>เปิดหน้านี้ไม่สำเร็จ</h1><p>กรุณาโหลดหน้าใหม่ หากเพิ่งยืนยันงาน ให้สแกน Tote เพื่อตรวจสอบสถานะก่อนทำซ้ำ</p><button className="primary" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button><a href="/">กลับหน้าเริ่มต้น</a></main>;
    return this.props.children;
  }
}
