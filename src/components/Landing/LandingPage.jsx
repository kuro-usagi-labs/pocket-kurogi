import { createElement } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, MessageCircle, Plus, ShieldCheck, Sparkles, Target, Wallet } from 'lucide-react'
import KurogiLogo from '../shared/KurogiLogo'
import ThemeToggle from '../shared/ThemeToggle'

const features = [
  { icon: MessageCircle, number: '01', title: 'Cukup cerita. Biar Kurogi yang rapikan.', text: 'Tulis pemasukan atau pengeluaran dengan bahasamu. Periksa rinciannya, lalu konfirmasi untuk mencatat.', className: 'feature-wide' },
  { icon: Wallet, number: '02', title: 'Banyak dompet, satu tempat.', text: 'Pisahkan uang harian, rekening, dan e-wallet. Lihat catatan perpindahan uang dengan lebih jelas.' },
  { icon: Target, number: '03', title: 'Impian besar dimulai dari kecil.', text: 'Buat target tabungan dan lihat progresnya. Sedikit demi sedikit, tujuanmu terasa lebih dekat.' },
]

export default function LandingPage({ onLogin }) {
  return <div className="public-page landing-page">
    <header className="public-nav">
      <a href="#" className="brand-lockup" aria-label="Pocket Kurogi, beranda"><KurogiLogo size={40} /><span>Pocket<span className="brand-light"> Kurogi</span><small>TEMAN UANGMU</small></span></a>
      <nav aria-label="Navigasi halaman awal"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#pertanyaan">Tanya jawab</a></nav>
      <div className="nav-actions"><ThemeToggle /><button className="button-primary compact" onClick={() => onLogin('login')}>Masuk <ArrowUpRight size={16} /></button></div>
    </header>
    <main>
      <section className="landing-hero landing-container">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> UANG LEBIH RAPI. HIDUP LEBIH TENANG.</span>
          <h1>Urus uangmu.<br /><span>Bukan pusingmu.</span></h1>
          <p>Kenalan dengan Kurogi, teman kecil untuk keuanganmu. Catat lewat chat, kenali kebiasaan, dan beri ruang untuk hal yang kamu impikan.</p>
          <div className="hero-actions"><button className="button-primary" onClick={() => onLogin('register')}>Mulai perjalananmu <ArrowUpRight size={19} /></button><a href="#cara-kerja" className="button-text">Lihat cara kerjanya <ArrowRight size={17} /></a></div>
          <div className="hero-notes"><span><Check size={15} /> Bahasa sehari-hari</span><span><Check size={15} /> Kamu tetap pegang kendali</span></div>
        </div>
        <div className="product-scene" aria-label="Ilustrasi aplikasi dengan data contoh">
          <div className="scene-label"><Sparkles size={15} /> Sedikit cerita, banyak yang tertata.</div>
          <div className="preview-window">
            <div className="preview-top"><div className="preview-dots"><i /><i /><i /></div><span>Ruang keuanganmu</span><span className="demo-label">DEMO</span></div>
            <div className="preview-content">
              <div className="preview-greeting"><span>Selamat datang kembali 👋<strong>Hari baik untuk mulai rapi.</strong></span><KurogiLogo size={43} /></div>
              <div className="preview-balance"><span>Total saldo dompet <Wallet size={17} /></span><strong>Rp8.450.000<span>,00</span></strong><div><span><ArrowDownLeft size={15} /> Pemasukan<strong>Rp6.500.000</strong></span><span><ArrowUpRight size={15} /> Pengeluaran<strong>Rp2.150.000</strong></span></div></div>
              <div className="preview-chat"><span className="mini-label">OBROLAN DENGAN KUROGI</span><p className="preview-user">Tadi ngopi 25rb pakai dompet Tunai</p><div className="preview-reply"><KurogiLogo size={29} /><div><p>Oke, ini rincian pengeluaranmu.</p><div className="preview-transaction"><span>☕<strong>Kopi<small>Tunai · Pengeluaran</small></strong></span><b>Rp25.000</b></div><span className="preview-confirm"><Check size={14} /> Konfirmasi pencatatan</span></div></div></div>
            </div>
          </div>
          <div className="floating-goal"><span className="goal-symbol"><Target size={21} /></span><div><strong>Liburan impian</strong><small>Selangkah lebih dekat ✨</small><div className="demo-progress"><span /></div></div><b>68%</b></div>
          <p className="demo-caption">Ilustrasi tampilan · bukan data keuangan asli</p>
        </div>
      </section>
      <section className="landing-strip"><div className="landing-container"><span><MessageCircle size={20} /> Catat lewat percakapan</span><span><Wallet size={20} /> Kelola semua dompet</span><span><Target size={20} /> Wujudkan target tabungan</span></div></section>
      <section id="fitur" className="landing-section landing-container">
        <div className="section-heading"><div><span className="eyebrow">LEBIH DARI CATAT ANGKA</span><h2>Tempat kecil untuk<br />rencana besarmu.</h2></div><p>Tidak perlu semuanya sempurna.<br />Mulai dari satu catatan hari ini.</p></div>
        <div className="feature-grid">{features.map(({ icon, number, title, text, className = '' }) => <article className={`feature-card ${className}`} key={number}><div className="feature-top"><span className="feature-icon">{createElement(icon, { size: 24 })}</span><span>{number}</span></div><h3>{title}</h3><p>{text}</p>{number === '01' && <div className="feature-example"><span>“Gajian 5 juta, masuk ke BCA”</span><ArrowRight size={18} /><span><Check size={14} /> Siap dikonfirmasi</span></div>}</article>)}</div>
      </section>
      <section id="cara-kerja" className="how-section landing-container"><div><span className="eyebrow">SESEDERHANA NGOBROL</span><h2>Kamu cerita.<br />Kurogi bantu catat.</h2><p>AI membantu memahami maksudmu. Mesin aplikasi memeriksa rincian sebelum perubahan disimpan.</p><div className="control-note"><ShieldCheck size={22} /><span>Tanpa akses ke rekening bank.<br />Kurogi mencatat, bukan memindahkan uang sungguhan.</span></div></div><ol>{[['Buat ruang keuanganmu', 'Daftar, lalu tambahkan dompet yang ingin kamu catat.'], ['Tulis dengan caramu', '“Bayar makan 30rb pakai Tunai” atau “pengeluaran bulan ini berapa?”'], ['Periksa, konfirmasi, beres', 'Pastikan nominal dan dompetnya sesuai. Catatanmu siap dilihat kapan saja.']].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
      <section id="pertanyaan" className="faq-section landing-container"><div><span className="eyebrow">SEBELUM MULAI</span><h2>Mungkin kamu<br />ingin tahu.</h2></div><div>{[['Harus menulis perintah yang kaku?', 'Tidak. Coba bahasa sehari-hari. Kalau ada detail yang kurang, Kurogi akan meminta penjelasan. Untuk pencatatan, periksa rincian sebelum mengonfirmasi.'], ['Apa yang terjadi kalau AI tidak tersedia?', 'Mesin lokal tetap tersedia untuk perintah yang dikenalnya. Kamu juga bisa mengelola data melalui menu aplikasi.'], ['Bisa dipakai malam hari?', 'Bisa. Pilih mode gelap dari tombol tema atau pengaturan aplikasi. Preferensi tema disimpan di perangkatmu.']].map(([q, a]) => <details key={q}><summary>{q}<Plus size={19} /></summary><p>{a}</p></details>)}</div></section>
      <section className="landing-cta landing-container"><div><span className="eyebrow">SATU LANGKAH KECIL HARI INI</span><h2>Besok lebih tenang.<br />Mulainya dari sekarang.</h2></div><button className="button-primary" onClick={() => onLogin('register')}>Buat ruangmu <ChevronRight size={20} /></button></section>
    </main>
    <footer className="landing-footer landing-container"><span className="brand-lockup"><KurogiLogo size={30} /> Pocket Kurogi</span><p>Teman mengatur uang, satu percakapan setiap waktu.</p><span>© {new Date().getFullYear()} Kurogi</span></footer>
  </div>
}
