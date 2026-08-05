export const WA_PHONE = "6281312322833";

export const WA_LINK = `https://api.whatsapp.com/send?phone=${WA_PHONE}&text=${encodeURIComponent(
  "sablon konveksi bandung?"
)}`;

export const NAV_LINKS = [
  { href: "#about", label: "Tentang" },
  { href: "#services", label: "Layanan" },
  { href: "#projects", label: "Projek" },
  { href: "#how-to-start", label: "Cara Order" },
  { href: "#contact", label: "Kontak" },
];

// The "ink registration strip" — the page's signature motif. Each chip
// stands in for one spot-color pass in a screen-print job.
export const INK_SWATCHES = [
  { code: "INK.01", name: "Biru Logo", var: "--primary" },
  { code: "INK.02", name: "Ochre", var: "--accent" },
  { code: "INK.03", name: "Teal", var: "--secondary" },
  { code: "INK.04", name: "Orange", var: "--accent-2" },
  { code: "INK.05", name: "Ink Black", var: "--ink" },
];

export const HERO_STATS = [
  { label: "Berdiri Sejak", value: "2015" },
  { label: "Lini Produksi", value: "3" },
  { label: "Proses In-House", value: "100%" },
];

export const HERO_SLIDES = [
  { image: "gambar2.jpg", alt: "Hasil sablon kaos custom 22Studio" },
  { image: "gambar3.jpg", alt: "Proses produksi konveksi 22Studio" },
  { image: "gambar4.jpg", alt: "Kaos custom siap kirim" },
  { image: "gambar5.jpg", alt: "Detail sablon berkualitas premium" },
  { image: "jumbotron.jpg", alt: "Workshop 22Studio Bandung" },
];

export const CLIENTS = [
  {
    name: "Persib Bandung",
    logo: "https://upload.wikimedia.org/wikipedia/min/thumb/d/db/Persib_Bandung.svg/1200px-Persib_Bandung.svg.png",
  },
  {
    name: "Lacoste",
    logo: "https://brandlogos.net/wp-content/uploads/2021/05/lacoste-crocodiles-logo.png",
  },
  {
    name: "Nike",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg",
  },
  {
    name: "Adidas",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg",
  },
  {
    name: "TNI",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/48/Insignia_of_the_Indonesian_National_Armed_Forces.svg",
  },
  {
    name: "Pertamina",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Pertamina_Logo.svg/1200px-Pertamina_Logo.svg.png",
  },
];

export const FOUNDERS_PROMISE = {
  quote:
    "Setiap kaos yang keluar dari workshop kami melewati pemeriksaan kualitas yang ketat. Kami tidak sekadar menyablon — kami mengerjakan cutting, sablon, jahit, QC, hingga finishing di bawah satu atap, supaya kualitasnya konsisten dari pcs pertama sampai terakhir. Itu janji kami ke setiap klien, kecil atau besar.",
  name: "Tino",
  role: "Founder, 22Studio",
};

export const SERVICES = [
  {
    icon: "shirt",
    swatch: "--primary",
    title: "Screen Printing",
    description:
      "Sablon tradisional untuk desain yang cerah dan tahan lama. Sempurna untuk pesanan massal dengan desain sederhana hingga rumit.",
    points: ["Terbaik untuk pesanan 25+", "Warna-warna cerah", "Cetakan tahan lama"],
  },
  {
    icon: "spray-can",
    swatch: "--accent",
    title: "DTF Printing",
    description:
      "Pencetakan langsung pada pakaian untuk desain yang realistis. Ideal untuk pesanan kecil atau desain dengan banyak warna.",
    points: ["Cocok untuk 1–24 buah", "Tidak ada batasan warna", "Hasil raba lembut"],
  },
  {
    icon: "scissors",
    swatch: "--secondary",
    title: "Embroidery",
    description:
      "Layanan bordir premium untuk tampilan profesional dan mewah. Sempurna untuk logo dan teks pada polo dan topi.",
    points: ["Tampilan profesional", "Tahan lama", "Cocok untuk pakaian kerja"],
  },
  {
    icon: "palette",
    swatch: "--accent-2",
    title: "Custom Design",
    description:
      "Desainer berbakat kami akan bekerja sama dengan Anda untuk menciptakan karya seni yang sempurna untuk pakaian khusus Anda.",
    points: ["Desainer profesional", "Revisi tanpa batas", "Perputaran cepat"],
  },
  {
    icon: "shirt",
    swatch: "--primary",
    title: "Sublimation",
    description:
      "Cetakan penuh warna untuk pakaian performa dan pakaian berwarna terang.",
    points: ["Cetakan menyeluruh yang cerah", "Tidak ada retak atau terkelupas", "Bagus untuk tim olahraga"],
  },
  {
    icon: "package",
    swatch: "--accent",
    title: "Private Label",
    description:
      "Ciptakan lini pakaian Anda sendiri dengan label, tag, dan kemasan khusus.",
    points: ["Pencitraan merek khusus", "Layanan label putih", "Diskon massal"],
  },
];

export const PROJECTS = [
  {
    title: "Merchandise Band Musik",
    description: "Kaos tur sablon untuk band rock indie",
    image:
      "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80",
  },
  {
    title: "Seragam Perusahaan",
    description: "Polo bordir khusus untuk perusahaan teknologi",
    image:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80",
  },
  {
    title: "Jersey Tim Olahraga",
    description: "Jersey basket sublimasi untuk liga lokal",
    image:
      "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80",
  },
  {
    title: "Kaos Charity",
    description: "Kaos cetak DTG untuk penggalangan dana lari 5K",
    image:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80",
  },
  {
    title: "Streetwear Collection",
    description: "Kaos grafis edisi terbatas untuk merek lokal",
    image:
      "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80",
  },
  {
    title: "Pakaian Sekolah",
    description: "Hoodie sablon untuk sekolah menengah",
    image:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80",
  },
];

export const STEPS = [
  {
    stage: "01",
    title: "Konsultasi",
    description:
      "Hubungi kami untuk mendiskusikan proyek Anda. Kami akan menanyakan tentang jumlah, desain, warna, preferensi kain, dan jadwal pengerjaan.",
  },
  {
    stage: "02",
    title: "Design",
    description:
      "Kirimkan karya seni atau pekerjaan Anda kepada desainer kami. Kami akan memberikan contoh dan rekomendasi untuk metode pencetakan terbaik.",
  },
  {
    stage: "03",
    title: "Persetujuan",
    description:
      "Tinjau dan setujui rancangan akhir. Kami akan memberikan penawaran harga terperinci dan jadwal produksi.",
  },
  {
    stage: "04",
    title: "Produksi",
    description:
      "Kami mencetak kaos Anda dengan hati-hati dan teliti. Pemeriksaan kualitas dilakukan di setiap tahap.",
  },
  {
    stage: "05",
    title: "Pengiriman",
    description:
      "Kemeja kustom Anda dikemas dengan hati-hati dan dikirim ke depan pintu Anda atau siap diambil.",
  },
];

export const STATS_BAND = [
  { value: 2015, prefix: "", suffix: "", label: "Tahun Berdiri" },
  { value: 3, prefix: "", suffix: "", label: "Lini Produksi Aktif" },
  { value: 100, prefix: "", suffix: "%", label: "Proses In-House" },
  { value: 10, prefix: "", suffix: "th+", label: "Pengalaman Produksi" },
];

export const FAQS = [
  {
    q: "Apa saja jenis produk yang bisa kami pesan di tempat Anda?",
    a: "Kami melayani berbagai kebutuhan sablon dan konveksi seperti kaos, hoodie, jaket, polo shirt, tote bag, seragam kerja, hingga merchandise custom.",
  },
  {
    q: "Apakah bisa custom desain sendiri?",
    a: "Tentu! Anda bisa mengirim desain sendiri dalam format PNG, AI, atau PDF. Kami juga menyediakan layanan desain jika Anda belum punya desain.",
  },
  {
    q: "Minimal pemesanan berapa pcs?",
    a: "Minimal order untuk konveksi adalah 12 pcs. Untuk sablon custom satuan bisa kami layani tergantung desain dan media yang digunakan.",
  },
  {
    q: "Apa saja jenis sablon yang tersedia?",
    a: "Kami menyediakan berbagai teknik sablon seperti sablon plastisol, rubber, polyflex, dan DTF (Direct to Film).",
  },
  {
    q: "Berapa lama proses produksinya?",
    a: "Waktu produksi tergantung jumlah pesanan dan kompleksitas desain. Rata-rata 5–14 hari kerja setelah desain disetujui dan DP dibayar.",
  },
  {
    q: "Apakah bisa order express?",
    a: "Bisa, kami menyediakan layanan express dengan waktu pengerjaan 1–3 hari tergantung ketersediaan bahan dan workload. Biaya tambahan berlaku.",
  },
  {
    q: "Bagaimana cara pemesanan?",
    a: "Anda bisa memesan melalui WhatsApp, form order di website, atau datang langsung ke workshop kami. Jangan lupa sertakan detail produk dan desain.",
  },
  {
    q: "Apakah tersedia katalog bahan dan warna?",
    a: "Ya, kami memiliki katalog bahan dan warna yang bisa dilihat langsung di workshop kami.",
  },
  {
    q: "Apakah bisa kirim ke luar kota atau luar negeri?",
    a: "Tentu, kami melayani pengiriman ke seluruh Indonesia via JNE, J&T, Sicepat, atau ekspedisi pilihan Anda.",
  },
  {
    q: "Bagaimana sistem pembayarannya?",
    a: "Pembayaran dilakukan dengan DP minimal 50% di awal, dan pelunasan saat produk siap kirim. Kami menerima transfer bank dan QRIS.",
  },
];

export const CONTACT_INFO = {
  address:
    "Jl. Cimerang No.14, RT.03/RW.05, Cimerang, Kec. Padalarang, Kabupaten Bandung Barat, Jawa Barat 40553",
  phone: "+62 813 1232 2833",
  email: "22Studio.tino@gmail.com",
  hours: ["Senin–Jumat: 09.00–18.00", "Sabtu: 10.00–16.00"],
  mapEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.1439687836223!2d107.4875514745986!3d-6.873347767250977!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e5445d090367%3A0xb859f3fd6ee9bba4!2s22Studio%20Sablon%20konveksi%20bandung!5e0!3m2!1sid!2sid!4v1746873374947!5m2!1sid!2sid",
};

export const FORM_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzs2uCsuGLBFdVgsnNo-iqBxvjRAOW1lqTTAm0jk1nwLSiW_5VBLd9IIicy-x_CEYWy/exec";
