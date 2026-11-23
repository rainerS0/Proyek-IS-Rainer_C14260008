// Nama key untuk penyimpanan di localStorage
const KEY_USERS = "kerjaku_users";
const KEY_SESSION = "kerjaku_session";
const KEY_PROYEK = "kerjaku_proyek";
const KEY_TUGAS = "kerjaku_tugas";
const KEY_TEMA = "kerjaku_tema";

const BATAS_UKURAN_FILE = 1.5 * 1024 * 1024; // Maksimal 1.5 MB per file

// Variabel global untuk kondisi aplikasi saat ini
let userAktif = null;
let halamanAktif = "dashboard";
let proyekTerpilihId = null;
let lampiranSementara = [];
let tugasDiseretId = null;
let aksiKonfirmasi = null;

// Fungsi bantu baca & tulis localStorage
function ambilData(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function simpanData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    tampilkanNotif("Penyimpanan browser penuh! Coba hapus lampiran berukuran besar.", "gagal");
    return false;
  }
}

function buatId(awalan) {
  return awalan + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

// Fungsi bantu tanggal & hitung sisa hari deadline
function tanggalHariIni() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${hari}`;
}

function hitungSelisihHari(tanggalTarget) {
  if (!tanggalTarget) return null;
  const hariIni = new Date(tanggalHariIni() + "T00:00:00");
  const target = new Date(tanggalTarget + "T00:00:00");
  return Math.round((target - hariIni) / (1000 * 60 * 60 * 24));
}

function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  const bagian = tanggalStr.split("-");
  const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${parseInt(bagian[2], 10)} ${namaBulan[parseInt(bagian[1], 10) - 1]} ${bagian[0]}`;
}

function buatLabelDeadline(tanggalStr, status) {
  const selisih = hitungSelisihHari(tanggalStr);
  if (selisih === null) return `<span class="label-status label-abu">-</span>`;
  if (status === "Done" || status === "Selesai") {
    return `<span class="label-status label-hijau">${formatTanggalIndo(tanggalStr)}</span>`;
  }
  if (selisih < 0) {
    return `<span class="label-status label-merah">Terlambat ${Math.abs(selisih)} hari</span>`;
  }
  if (selisih === 0) {
    return `<span class="label-status label-merah">Hari ini</span>`;
  }
  if (selisih <= 3) {
    return `<span class="label-status label-kuning">H-${selisih} (${formatTanggalIndo(tanggalStr)})</span>`;
  }
  return `<span class="label-status label-abu">${formatTanggalIndo(tanggalStr)}</span>`;
}

// Notifikasi Toast
function tampilkanNotif(pesan, tipe = "info") {
  const wadah = document.getElementById("wadah-notifikasi");
  const elemen = document.createElement("div");
  elemen.className = `notifikasi ${tipe}`;
  elemen.textContent = pesan;
  wadah.appendChild(elemen);

  setTimeout(() => {
    elemen.remove();
  }, 3000);
}

// Mode Gelap & Terang (CSS Variables + localStorage)
function inisialisasiTema() {
  const temaTersimpan = localStorage.getItem(KEY_TEMA) || "light";
  terapkanTema(temaTersimpan);
}

function terapkanTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(KEY_TEMA, tema);
  document.querySelectorAll(".tombol-tema").forEach((btn) => {
    btn.innerHTML = tema === "dark" ? `<i class="bi bi-sun"></i>` : `<i class="bi bi-moon-stars"></i>`;
  });
}

function gantiTema() {
  const temaSekarang = document.documentElement.getAttribute("data-theme");
  const temaBaru = temaSekarang === "dark" ? "light" : "dark";
  terapkanTema(temaBaru);
  tampilkanNotif(`Mode ${temaBaru === "dark" ? "Gelap" : "Terang"} aktif`);
}

// =AUTENTIKASI & PROTEKSI HALAMAN=
function cekStatusLogin() {
  const sesi = JSON.parse(localStorage.getItem(KEY_SESSION) || "null");
  if (!sesi || !sesi.userId) {
    userAktif = null;
    tampilkanHalamanAuth();
    return false;
  }

  const daftarUser = ambilData(KEY_USERS);
  const userCocok = daftarUser.find((u) => u.id === sesi.userId);
  if (!userCocok) {
    localStorage.removeItem(KEY_SESSION);
    userAktif = null;
    tampilkanHalamanAuth();
    return false;
  }

  userAktif = userCocok;
  tampilkanHalamanUtama();
  return true;
}

function tampilkanHalamanAuth() {
  document.getElementById("halaman-auth").classList.remove("sembunyi");
  document.getElementById("halaman-utama").classList.add("sembunyi");
}

function tampilkanHalamanUtama() {
  if (!userAktif) {
    tampilkanHalamanAuth();
    return;
  }
  document.getElementById("halaman-auth").classList.add("sembunyi");
  document.getElementById("halaman-utama").classList.remove("sembunyi");

  document.getElementById("nama-user-tampil").textContent = userAktif.nama;
  document.getElementById("email-user-tampil").textContent = userAktif.email;
  document.getElementById("avatar-user").textContent = userAktif.nama.charAt(0).toUpperCase();

  pindahHalaman("dashboard");
}

function bersihkanErrorForm(form) {
  form.querySelectorAll(".pesan-error").forEach((el) => (el.textContent = ""));
}

function prosesRegister(e) {
  e.preventDefault();
  const form = e.target;
  bersihkanErrorForm(form);

  const nama = document.getElementById("reg-nama").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const konfirmasi = document.getElementById("reg-konfirmasi").value;

  let valid = true;
  if (nama.length < 3) {
    document.getElementById("err-reg-nama").textContent = "Nama minimal 3 karakter.";
    valid = false;
  }
  if (!email.includes("@") || !email.includes(".")) {
    document.getElementById("err-reg-email").textContent = "Format email tidak valid.";
    valid = false;
  }
  if (password.length < 6) {
    document.getElementById("err-reg-password").textContent = "Password minimal 6 karakter.";
    valid = false;
  }
  if (password !== konfirmasi) {
    document.getElementById("err-reg-konfirmasi").textContent = "Konfirmasi password tidak sama.";
    valid = false;
  }

  if (!valid) {
    tampilkanNotif("Periksa kembali data pendaftaran.", "gagal");
    return;
  }

  const daftarUser = ambilData(KEY_USERS);
  if (daftarUser.some((u) => u.email === email)) {
    document.getElementById("err-reg-email").textContent = "Email sudah terdaftar.";
    tampilkanNotif("Email sudah digunakan akun lain.", "gagal");
    return;
  }

  const userBaru = {
    id: buatId("user"),
    nama: nama,
    email: email,
    password: password
  };

  daftarUser.push(userBaru);
  simpanData(KEY_USERS, daftarUser);
  localStorage.setItem(KEY_SESSION, JSON.stringify({ userId: userBaru.id }));

  userAktif = userBaru;
  form.reset();
  tampilkanNotif("Akun berhasil dibuat!", "sukses");
  tampilkanHalamanUtama();
}

function prosesLogin(e) {
  e.preventDefault();
  const form = e.target;
  bersihkanErrorForm(form);

  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  if (!email) {
    document.getElementById("err-login-email").textContent = "Email wajib diisi.";
    return;
  }
  if (!password) {
    document.getElementById("err-login-password").textContent = "Password wajib diisi.";
    return;
  }

  const daftarUser = ambilData(KEY_USERS);
  const userCocok = daftarUser.find((u) => u.email === email && u.password === password);

  if (!userCocok) {
    document.getElementById("err-login-password").textContent = "Email atau password salah.";
    tampilkanNotif("Login gagal. Periksa email dan password.", "gagal");
    return;
  }

  localStorage.setItem(KEY_SESSION, JSON.stringify({ userId: userCocok.id }));
  userAktif = userCocok;
  form.reset();
  tampilkanNotif(`Halo, ${userCocok.nama}!`, "sukses");
  tampilkanHalamanUtama();
}

function prosesLogout() {
  localStorage.removeItem(KEY_SESSION);
  userAktif = null;
  proyekTerpilihId = null;
  tampilkanNotif("Berhasil logout.");
  tampilkanHalamanAuth();
}

// =AMBIL DATA MILIK USER LOGIN=
function ambilProyekUser() {
  if (!userAktif) return [];
  return ambilData(KEY_PROYEK).filter((p) => p.userId === userAktif.id);
}

function ambilTugasUser() {
  if (!userAktif) return [];
  const daftarIdProyek = ambilProyekUser().map((p) => p.id);
  return ambilData(KEY_TUGAS).filter((t) => daftarIdProyek.includes(t.projectId));
}

function hitungProgresProyek(projectId) {
  const tugasProyek = ambilTugasUser().filter((t) => t.projectId === projectId);
  const total = tugasProyek.length;
  const selesai = tugasProyek.filter((t) => t.status === "Done").length;
  const persen = total === 0 ? 0 : Math.round((selesai / total) * 100);
  return { total, selesai, persen };
}

// =NAVIGASI HALAMAN=
function pindahHalaman(tujuan, projectId = null) {
  // Pastikan user sudah login sebelum membuka halaman apapun
  if (!userAktif) {
    tampilkanHalamanAuth();
    return;
  }

  halamanAktif = tujuan;
  proyekTerpilihId = projectId;

  // Tutup sidebar jika dibuka lewat HP
  document.getElementById("sidebar").classList.remove("buka");
  document.getElementById("overlay-sidebar").classList.add("sembunyi");

  document.querySelectorAll(".item-menu").forEach((btn) => {
    btn.classList.toggle("aktif", btn.dataset.halaman === tujuan && !projectId);
  });

  document.getElementById("bagian-dashboard").classList.add("sembunyi");
  document.getElementById("bagian-proyek").classList.add("sembunyi");
  document.getElementById("bagian-tugas").classList.add("sembunyi");

  if (tujuan === "dashboard") {
    document.getElementById("judul-halaman").textContent = "Dashboard";
    document.getElementById("subjudul-halaman").textContent = "Ringkasan proyek dan tugas harian";
    document.getElementById("bagian-dashboard").classList.remove("sembunyi");
    tampilkanDashboard();
  } else if (tujuan === "proyek") {
    document.getElementById("judul-halaman").textContent = "Daftar Proyek";
    document.getElementById("subjudul-halaman").textContent = "Kelola seluruh proyek yang sedang dikerjakan";
    document.getElementById("bagian-proyek").classList.remove("sembunyi");
    tampilkanDaftarProyek();
  } else if (tujuan === "tugas") {
    const proyek = projectId ? ambilProyekUser().find((p) => p.id === projectId) : null;
    document.getElementById("judul-halaman").textContent = proyek ? proyek.nama : "Semua Tugas";
    document.getElementById("subjudul-halaman").textContent = proyek
      ? "Kelola tugas dan status dalam proyek ini"
      : "Daftar seluruh tugas dari semua proyek";
    document.getElementById("bagian-tugas").classList.remove("sembunyi");
    tampilkanTugas();
  }

  perbaruiSidebar();
}

function perbaruiSidebar() {
  const proyek = ambilProyekUser();
  const tugas = ambilTugasUser();

  document.getElementById("badge-jml-proyek").textContent = proyek.length;
  document.getElementById("badge-jml-tugas").textContent = tugas.length;

  const wadah = document.getElementById("list-proyek-sidebar");
  if (proyek.length === 0) {
    wadah.innerHTML = `<p class="teks-redup" style="padding: 6px;">Belum ada proyek</p>`;
    return;
  }

  wadah.innerHTML = proyek
    .map((p) => {
      const aktif = halamanAktif === "tugas" && proyekTerpilihId === p.id ? "aktif" : "";
      const prog = hitungProgresProyek(p.id);
      return `
        <button type="button" class="btn-proyek-sidebar ${aktif}" onclick="pindahHalaman('tugas', '${p.id}')">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.nama}</span>
          <span class="badge-angka">${prog.selesai}/${prog.total}</span>
        </button>
      `;
    })
    .join("");
}

// =DASHBOARD=
function tampilkanDashboard() {
  const proyek = ambilProyekUser();
  const tugas = ambilTugasUser();

  const proyekBerjalan = proyek.filter((p) => p.status === "Berjalan").length;
  const jmlTodo = tugas.filter((t) => t.status === "To-do").length;
  const jmlProgress = tugas.filter((t) => t.status === "In-Progress").length;
  const jmlDone = tugas.filter((t) => t.status === "Done").length;
  const persen = tugas.length === 0 ? 0 : Math.round((jmlDone / tugas.length) * 100);

  document.getElementById("angka-total-proyek").textContent = proyek.length;
  document.getElementById("ket-proyek-aktif").textContent = `${proyekBerjalan} proyek berjalan`;
  document.getElementById("angka-todo").textContent = jmlTodo;
  document.getElementById("angka-progress").textContent = jmlProgress;
  document.getElementById("angka-done").textContent = jmlDone;
  document.getElementById("ket-persen-selesai").textContent = `${persen}% selesai`;

  // Tugas dengan deadline dekat (<= 3 hari atau sudah lewat & belum Done)
  const tugasMendesak = tugas
    .filter((t) => t.status !== "Done" && hitungSelisihHari(t.deadline) !== null && hitungSelisihHari(t.deadline) <= 3)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const wadahDeadline = document.getElementById("wadah-deadline-dekat");
  if (tugasMendesak.length === 0) {
    wadahDeadline.innerHTML = `<div class="kotak-kosong">Tidak ada tugas dengan deadline dekat.</div>`;
  } else {
    wadahDeadline.innerHTML = tugasMendesak
      .map((t) => {
        const namaProyek = proyek.find((p) => p.id === t.projectId)?.nama || "-";
        return `
          <div class="item-deadline" onclick="pindahHalaman('tugas', '${t.projectId}')">
            <div>
              <strong>${t.judul}</strong>
              <div class="teks-redup">Proyek: ${namaProyek} &bull; Status: ${t.status}</div>
            </div>
            ${buatLabelDeadline(t.deadline, t.status)}
          </div>
        `;
      })
      .join("");
  }

  // Ringkasan Proyek di Dashboard
  const wadahProyek = document.getElementById("wadah-ringkasan-proyek");
  if (proyek.length === 0) {
    wadahProyek.innerHTML = `
      <div class="kotak-kosong">
        <p style="margin-bottom: 10px;">Belum ada proyek yang dibuat.</p>
        <button type="button" class="btn btn-utama btn-kecil" onclick="bukaModalProyek()">+ Buat Proyek Pertama</button>
      </div>
    `;
  } else {
    wadahProyek.innerHTML = proyek
      .slice(0, 4)
      .map((p) => {
        const prog = hitungProgresProyek(p.id);
        return `
          <div class="item-proyek-ringkas" onclick="pindahHalaman('tugas', '${p.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong>${p.nama}</strong>
              <span class="label-status ${ambilWarnaStatusProyek(p.status)}">${p.status}</span>
            </div>
            <div class="teks-redup">${prog.selesai} dari ${prog.total} tugas selesai (${prog.persen}%)</div>
            <div class="jalur-progres">
              <div class="isi-progres" style="width:${prog.persen}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

function ambilWarnaStatusProyek(status) {
  if (status === "Selesai") return "label-hijau";
  if (status === "Berjalan") return "label-biru";
  return "label-abu";
}

// =CRUD PROYEK=
function tampilkanDaftarProyek() {
  const kataKunci = document.getElementById("cari-proyek").value.trim().toLowerCase();
  const filterStatus = document.getElementById("filter-status-proyek").value;

  let daftar = ambilProyekUser();
  if (kataKunci) {
    daftar = daftar.filter(
      (p) => p.nama.toLowerCase().includes(kataKunci) || p.deskripsi.toLowerCase().includes(kataKunci)
    );
  }
  if (filterStatus !== "SEMUA") {
    daftar = daftar.filter((p) => p.status === filterStatus);
  }

  const grid = document.getElementById("grid-daftar-proyek");
  if (daftar.length === 0) {
    grid.innerHTML = `
      <div class="kotak-kosong" style="grid-column: 1 / -1;">
        <p style="margin-bottom: 10px;">Data proyek tidak ditemukan atau masih kosong.</p>
        <button type="button" class="btn btn-utama btn-kecil" onclick="bukaModalProyek()">+ Tambah Proyek</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = daftar
    .map((p) => {
      const prog = hitungProgresProyek(p.id);
      return `
        <div class="kartu-proyek">
          <div>
            <div class="kartu-proyek-atas">
              <h3 onclick="pindahHalaman('tugas', '${p.id}')">${p.nama}</h3>
              <span class="label-status ${ambilWarnaStatusProyek(p.status)}">${p.status}</span>
            </div>
            <p class="teks-redup" style="margin-bottom: 12px;">${p.deskripsi}</p>
            <div class="teks-redup">Progres: ${prog.selesai}/${prog.total} tugas (${prog.persen}%)</div>
            <div class="jalur-progres">
              <div class="isi-progres" style="width:${prog.persen}%"></div>
            </div>
          </div>

          <div class="kartu-proyek-bawah">
            ${buatLabelDeadline(p.deadline, p.status)}
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn btn-sekunder btn-kecil" onclick="pindahHalaman('tugas', '${p.id}')">Tugas</button>
              <button type="button" class="btn btn-sekunder btn-kecil" onclick="bukaModalProyek('${p.id}')">Edit</button>
              <button type="button" class="btn btn-sekunder btn-kecil teks-merah" onclick="konfirmasiHapusProyek('${p.id}')">Hapus</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function bukaModalProyek(projectId = null) {
  const form = document.getElementById("form-proyek");
  bersihkanErrorForm(form);
  form.reset();

  document.getElementById("input-id-proyek").value = projectId || "";

  if (projectId) {
    const proyek = ambilProyekUser().find((p) => p.id === projectId);
    if (!proyek) return;
    document.getElementById("judul-modal-proyek").textContent = "Edit Proyek";
    document.getElementById("input-nama-proyek").value = proyek.nama;
    document.getElementById("input-deskripsi-proyek").value = proyek.deskripsi;
    document.getElementById("input-deadline-proyek").value = proyek.deadline;
    document.getElementById("input-status-proyek").value = proyek.status;
  } else {
    document.getElementById("judul-modal-proyek").textContent = "Tambah Proyek Baru";
    document.getElementById("input-deadline-proyek").value = tanggalHariIni();
    document.getElementById("input-status-proyek").value = "Berjalan";
  }

  bukaModal("modal-proyek");
}

function simpanProyek(e) {
  e.preventDefault();
  const form = e.target;
  bersihkanErrorForm(form);

  const id = document.getElementById("input-id-proyek").value;
  const nama = document.getElementById("input-nama-proyek").value.trim();
  const deskripsi = document.getElementById("input-deskripsi-proyek").value.trim();
  const deadline = document.getElementById("input-deadline-proyek").value;
  const status = document.getElementById("input-status-proyek").value;

  let valid = true;
  if (!nama) {
    document.getElementById("err-nama-proyek").textContent = "Nama proyek wajib diisi.";
    valid = false;
  }
  if (!deskripsi) {
    document.getElementById("err-deskripsi-proyek").textContent = "Deskripsi proyek wajib diisi.";
    valid = false;
  }
  if (!deadline) {
    document.getElementById("err-deadline-proyek").textContent = "Deadline proyek wajib diisi.";
    valid = false;
  }

  if (!valid) {
    tampilkanNotif("Lengkapi semua kolom proyek.", "gagal");
    return;
  }

  const semuaProyek = ambilData(KEY_PROYEK);

  if (id) {
    const index = semuaProyek.findIndex((p) => p.id === id);
    if (index !== -1) {
      semuaProyek[index] = { ...semuaProyek[index], nama, deskripsi, deadline, status };
      simpanData(KEY_PROYEK, semuaProyek);
      tampilkanNotif("Proyek berhasil diperbarui.", "sukses");
    }
  } else {
    semuaProyek.unshift({
      id: buatId("proj"),
      userId: userAktif.id,
      nama,
      deskripsi,
      deadline,
      status
    });
    simpanData(KEY_PROYEK, semuaProyek);
    tampilkanNotif("Proyek baru berhasil ditambahkan.", "sukses");
  }

  tutupModal("modal-proyek");
  muatUlangHalamanAktif();
}

function konfirmasiHapusProyek(projectId) {
  const proyek = ambilProyekUser().find((p) => p.id === projectId);
  if (!proyek) return;

  const jumlahTugas = ambilTugasUser().filter((t) => t.projectId === projectId).length;

  bukaModalKonfirmasi(
    "Hapus Proyek",
    `Proyek "${proyek.nama}" dan ${jumlahTugas} tugas di dalamnya akan ikut terhapus. Yakin ingin melanjutkan?`,
    () => {
      const sisaProyek = ambilData(KEY_PROYEK).filter((p) => p.id !== projectId);
      // Hapus semua tugas yang terhubung ke proyek ini
      const sisaTugas = ambilData(KEY_TUGAS).filter((t) => t.projectId !== projectId);

      simpanData(KEY_PROYEK, sisaProyek);
      simpanData(KEY_TUGAS, sisaTugas);
      tampilkanNotif("Proyek dan tugas di dalamnya berhasil dihapus.", "sukses");

      if (proyekTerpilihId === projectId) {
        pindahHalaman("proyek");
      } else {
        muatUlangHalamanAktif();
      }
    }
  );
}

// =CRUD TUGAS, FILTER, & DRAG-DROP=
function tampilkanTugas() {
  const daftarProyek = ambilProyekUser();
  const banner = document.getElementById("banner-detail-proyek");
  const filterProyekSelect = document.getElementById("filter-proyek-tugas");

  filterProyekSelect.innerHTML =
    `<option value="SEMUA">Semua Proyek</option>` +
    daftarProyek.map((p) => `<option value="${p.id}">${p.nama}</option>`).join("");

  if (proyekTerpilihId) {
    const proyek = daftarProyek.find((p) => p.id === proyekTerpilihId);
    if (!proyek) {
      pindahHalaman("proyek");
      return;
    }
    banner.classList.remove("sembunyi");
    filterProyekSelect.value = proyek.id;
    filterProyekSelect.classList.add("sembunyi");

    const prog = hitungProgresProyek(proyek.id);
    document.getElementById("detail-nama-proyek").textContent = proyek.nama;
    const labelStatus = document.getElementById("detail-status-proyek");
    labelStatus.textContent = proyek.status;
    labelStatus.className = `label-status ${ambilWarnaStatusProyek(proyek.status)}`;
    document.getElementById("detail-deskripsi-proyek").textContent = proyek.deskripsi;
    document.getElementById("detail-deadline-proyek").innerHTML = `Deadline: ${buatLabelDeadline(proyek.deadline, proyek.status)}`;
    document.getElementById("detail-progres-proyek").textContent = `Progres: ${prog.selesai}/${prog.total} tugas (${prog.persen}%)`;
    document.getElementById("bar-progres-proyek").style.width = `${prog.persen}%`;
  } else {
    banner.classList.add("sembunyi");
    filterProyekSelect.classList.remove("sembunyi");
  }

  // Ambil nilai filter & pencarian
  const kataKunci = document.getElementById("cari-tugas").value.trim().toLowerCase();
  const pilihProyek = proyekTerpilihId || filterProyekSelect.value;
  const pilihStatus = document.getElementById("filter-status-tugas").value;
  const pilihDeadline = document.getElementById("filter-deadline-tugas").value;

  const adaFilter =
    kataKunci !== "" ||
    (!proyekTerpilihId && pilihProyek !== "SEMUA") ||
    pilihStatus !== "SEMUA" ||
    pilihDeadline !== "SEMUA";
  document.getElementById("btn-reset-filter").classList.toggle("sembunyi", !adaFilter);

  let daftarTugas = ambilTugasUser();
  if (pilihProyek !== "SEMUA") {
    daftarTugas = daftarTugas.filter((t) => t.projectId === pilihProyek);
  }
  if (pilihStatus !== "SEMUA") {
    daftarTugas = daftarTugas.filter((t) => t.status === pilihStatus);
  }
  if (pilihDeadline === "DEKAT") {
    daftarTugas = daftarTugas.filter((t) => t.status !== "Done" && hitungSelisihHari(t.deadline) !== null && hitungSelisihHari(t.deadline) <= 3);
  } else if (pilihDeadline === "TERLAMBAT") {
    daftarTugas = daftarTugas.filter((t) => t.status !== "Done" && hitungSelisihHari(t.deadline) !== null && hitungSelisihHari(t.deadline) < 0);
  }
  if (kataKunci) {
    daftarTugas = daftarTugas.filter(
      (t) => t.judul.toLowerCase().includes(kataKunci) || t.deskripsi.toLowerCase().includes(kataKunci)
    );
  }

  // Isi 3 kolom Kanban
  const daftarStatus = ["To-do", "In-Progress", "Done"];
  const idHitung = { "To-do": "hitung-todo", "In-Progress": "hitung-progress", Done: "hitung-done" };

  daftarStatus.forEach((status) => {
    const tugasKolom = daftarTugas.filter((t) => t.status === status);
    document.getElementById(idHitung[status]).textContent = tugasKolom.length;

    const zona = document.getElementById(`kolom-${status}`);
    if (tugasKolom.length === 0) {
      zona.innerHTML = `<div class="kotak-kosong">Kosong</div>`;
      return;
    }

    zona.innerHTML = tugasKolom
      .map((t) => {
        const namaProyek = daftarProyek.find((p) => p.id === t.projectId)?.nama || "Proyek";
        const lampiranHtml =
          t.lampiran && t.lampiran.length > 0
            ? `<div class="bar-lampiran">
                ${t.lampiran
                  .map(
                    (file) => `
                    <button type="button" class="chip-lampiran" onclick="lihatLampiran('${t.id}', '${file.id}')">
                      <i class="bi bi-paperclip"></i> ${file.nama}
                    </button>
                  `
                  )
                  .join("")}
               </div>`
            : "";

        return `
          <div class="kartu-tugas ${t.status === "Done" ? "selesai" : ""}" draggable="true" data-id-tugas="${t.id}">
            <span class="tag-proyek-tugas">${namaProyek}</span>
            <div class="judul-tugas">${t.judul}</div>
            <p class="teks-redup">${t.deskripsi}</p>
            ${lampiranHtml}
            <div class="kartu-tugas-bawah">
              ${buatLabelDeadline(t.deadline, t.status)}
              <div style="display:flex;align-items:center;gap:4px;">
                <select class="pilih-status-cepat" onchange="ubahStatusTugas('${t.id}', this.value)">
                  <option value="To-do" ${t.status === "To-do" ? "selected" : ""}>To-do</option>
                  <option value="In-Progress" ${t.status === "In-Progress" ? "selected" : ""}>In-Progress</option>
                  <option value="Done" ${t.status === "Done" ? "selected" : ""}>Done</option>
                </select>
                <button type="button" class="btn-ikon" onclick="bukaModalTugas('${t.id}')" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn-ikon teks-merah" onclick="konfirmasiHapusTugas('${t.id}')" title="Hapus">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  });

  aktifkanEventKartuDrag();
}

function aktifkanEventKartuDrag() {
  document.querySelectorAll(".kartu-tugas").forEach((kartu) => {
    kartu.addEventListener("dragstart", (e) => {
      tugasDiseretId = kartu.dataset.idTugas;
      kartu.classList.add("sedang-diseret");
      e.dataTransfer.setData("text/plain", tugasDiseretId);
    });

    kartu.addEventListener("dragend", () => {
      kartu.classList.remove("sedang-diseret");
      tugasDiseretId = null;
      document.querySelectorAll(".zona-drop").forEach((z) => z.classList.remove("sedang-diarahkan"));
    });
  });
}

function siapkanZonaDrop() {
  document.querySelectorAll(".zona-drop").forEach((zona) => {
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      zona.classList.add("sedang-diarahkan");
    });

    zona.addEventListener("dragleave", () => {
      zona.classList.remove("sedang-diarahkan");
    });

    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      zona.classList.remove("sedang-diarahkan");
      const idTugas = e.dataTransfer.getData("text/plain") || tugasDiseretId;
      const statusTujuan = zona.dataset.status;
      if (idTugas && statusTujuan) {
        ubahStatusTugas(idTugas, statusTujuan);
      }
    });
  });
}

function ubahStatusTugas(taskId, statusBaru) {
  const semuaTugas = ambilData(KEY_TUGAS);
  const index = semuaTugas.findIndex((t) => t.id === taskId);
  if (index === -1 || semuaTugas[index].status === statusBaru) return;

  semuaTugas[index].status = statusBaru;
  simpanData(KEY_TUGAS, semuaTugas);
  tampilkanNotif(`Status tugas dipindah ke ${statusBaru}`, "sukses");
  muatUlangHalamanAktif();
}

function bukaModalTugas(taskId = null) {
  const daftarProyek = ambilProyekUser();
  if (daftarProyek.length === 0) {
    tampilkanNotif("Buat proyek terlebih dahulu sebelum menambah tugas.", "gagal");
    bukaModalProyek();
    return;
  }

  const form = document.getElementById("form-tugas");
  bersihkanErrorForm(form);
  form.reset();
  lampiranSementara = [];

  const selectProyek = document.getElementById("pilih-proyek-tugas");
  selectProyek.innerHTML = daftarProyek.map((p) => `<option value="${p.id}">${p.nama}</option>`).join("");

  document.getElementById("input-id-tugas").value = taskId || "";

  if (taskId) {
    const tugas = ambilTugasUser().find((t) => t.id === taskId);
    if (!tugas) return;
    document.getElementById("judul-modal-tugas").textContent = "Edit Tugas";
    selectProyek.value = tugas.projectId;
    document.getElementById("input-judul-tugas").value = tugas.judul;
    document.getElementById("input-deskripsi-tugas").value = tugas.deskripsi;
    document.getElementById("input-deadline-tugas").value = tugas.deadline;
    document.getElementById("input-status-tugas").value = tugas.status;
    lampiranSementara = [...(tugas.lampiran || [])];
  } else {
    document.getElementById("judul-modal-tugas").textContent = "Tambah Tugas Baru";
    if (proyekTerpilihId) {
      selectProyek.value = proyekTerpilihId;
    }
    document.getElementById("input-deadline-tugas").value = tanggalHariIni();
    document.getElementById("input-status-tugas").value = "To-do";
  }

  tampilkanPreviewLampiranForm();
  bukaModal("modal-tugas");
}

function handleUploadLampiran(e) {
  const files = Array.from(e.target.files || []);
  const errEl = document.getElementById("err-lampiran-tugas");
  errEl.textContent = "";

  files.forEach((file) => {
    if (file.size > BATAS_UKURAN_FILE) {
      errEl.textContent = `Ukuran "${file.name}" melebihi 1.5 MB.`;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      lampiranSementara.push({
        id: buatId("file"),
        nama: file.name,
        tipe: file.type,
        dataUrl: reader.result
      });
      tampilkanPreviewLampiranForm();
    };
    reader.readAsDataURL(file);
  });

  e.target.value = "";
}

function tampilkanPreviewLampiranForm() {
  const wadah = document.getElementById("daftar-preview-lampiran");
  wadah.innerHTML = lampiranSementara
    .map(
      (file) => `
      <div class="baris-lampiran-form">
        <span><i class="bi bi-file-earmark"></i> ${file.nama}</span>
        <button type="button" class="tombol-teks teks-merah" onclick="hapusLampiranSementara('${file.id}')">Hapus</button>
      </div>
    `
    )
    .join("");
}

function hapusLampiranSementara(fileId) {
  lampiranSementara = lampiranSementara.filter((f) => f.id !== fileId);
  tampilkanPreviewLampiranForm();
}

function simpanTugas(e) {
  e.preventDefault();
  const form = e.target;
  bersihkanErrorForm(form);

  const id = document.getElementById("input-id-tugas").value;
  const projectId = document.getElementById("pilih-proyek-tugas").value;
  const judul = document.getElementById("input-judul-tugas").value.trim();
  const deskripsi = document.getElementById("input-deskripsi-tugas").value.trim();
  const deadline = document.getElementById("input-deadline-tugas").value;
  const status = document.getElementById("input-status-tugas").value;

  let valid = true;
  if (!projectId) {
    document.getElementById("err-proyek-tugas").textContent = "Pilih proyek terkait.";
    valid = false;
  }
  if (!judul) {
    document.getElementById("err-judul-tugas").textContent = "Judul tugas wajib diisi.";
    valid = false;
  }
  if (!deskripsi) {
    document.getElementById("err-deskripsi-tugas").textContent = "Deskripsi tugas wajib diisi.";
    valid = false;
  }
  if (!deadline) {
    document.getElementById("err-deadline-tugas").textContent = "Deadline tugas wajib diisi.";
    valid = false;
  }

  if (!valid) {
    tampilkanNotif("Lengkapi semua kolom tugas.", "gagal");
    return;
  }

  const semuaTugas = ambilData(KEY_TUGAS);
  let berhasil = false;

  if (id) {
    const index = semuaTugas.findIndex((t) => t.id === id);
    if (index !== -1) {
      semuaTugas[index] = {
        ...semuaTugas[index],
        projectId,
        judul,
        deskripsi,
        deadline,
        status,
        lampiran: [...lampiranSementara]
      };
      berhasil = simpanData(KEY_TUGAS, semuaTugas);
      if (berhasil) tampilkanNotif("Tugas berhasil diperbarui.", "sukses");
    }
  } else {
    semuaTugas.unshift({
      id: buatId("task"),
      projectId,
      judul,
      deskripsi,
      deadline,
      status,
      lampiran: [...lampiranSementara]
    });
    berhasil = simpanData(KEY_TUGAS, semuaTugas);
    if (berhasil) tampilkanNotif("Tugas baru berhasil ditambahkan.", "sukses");
  }

  if (berhasil) {
    tutupModal("modal-tugas");
    muatUlangHalamanAktif();
  }
}

function konfirmasiHapusTugas(taskId) {
  const tugas = ambilTugasUser().find((t) => t.id === taskId);
  if (!tugas) return;

  bukaModalKonfirmasi("Hapus Tugas", `Yakin ingin menghapus tugas "${tugas.judul}"?`, () => {
    const sisaTugas = ambilData(KEY_TUGAS).filter((t) => t.id !== taskId);
    simpanData(KEY_TUGAS, sisaTugas);
    tampilkanNotif("Tugas berhasil dihapus.", "sukses");
    muatUlangHalamanAktif();
  });
}

function lihatLampiran(taskId, fileId) {
  const tugas = ambilTugasUser().find((t) => t.id === taskId);
  if (!tugas) return;
  const file = (tugas.lampiran || []).find((f) => f.id === fileId);
  if (!file) return;

  document.getElementById("judul-modal-lampiran").textContent = file.nama;
  const btnUnduh = document.getElementById("btn-unduh-lampiran");
  btnUnduh.href = file.dataUrl;
  btnUnduh.download = file.nama;

  const isi = document.getElementById("isi-modal-lampiran");
  if (file.tipe.startsWith("image/")) {
    isi.innerHTML = `<img src="${file.dataUrl}" alt="${file.nama}" />`;
  } else if (file.tipe === "application/pdf") {
    isi.innerHTML = `<iframe src="${file.dataUrl}"></iframe>`;
  } else {
    isi.innerHTML = `<p>Pratinjau tidak tersedia untuk tipe file ini. Silakan klik tombol <strong>Unduh File</strong> di bawah.</p>`;
  }

  bukaModal("modal-lampiran");
}

// =MODAL & EVENT LISTENER=
function bukaModal(idModal) {
  document.getElementById(idModal).classList.remove("sembunyi");
}

function tutupModal(idModal) {
  document.getElementById(idModal).classList.add("sembunyi");
}

function bukaModalKonfirmasi(judul, teks, callbackHapus) {
  document.getElementById("judul-konfirmasi").textContent = judul;
  document.getElementById("teks-konfirmasi").textContent = teks;
  aksiKonfirmasi = callbackHapus;
  bukaModal("modal-konfirmasi");
}

function muatUlangHalamanAktif() {
  perbaruiSidebar();
  if (halamanAktif === "dashboard") tampilkanDashboard();
  else if (halamanAktif === "proyek") tampilkanDaftarProyek();
  else if (halamanAktif === "tugas") tampilkanTugas();
}

// Jalankan saat halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
  inisialisasiTema();
  siapkanZonaDrop();

  // Tombol ganti tema
  document.querySelectorAll(".tombol-tema").forEach((btn) => {
    btn.addEventListener("click", gantiTema);
  });

  // Tab Login & Register
  const btnTabLogin = document.getElementById("btn-tab-login");
  const btnTabRegister = document.getElementById("btn-tab-register");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");

  btnTabLogin.addEventListener("click", () => {
    btnTabLogin.classList.add("aktif");
    btnTabRegister.classList.remove("aktif");
    formLogin.classList.remove("sembunyi");
    formRegister.classList.add("sembunyi");
  });

  btnTabRegister.addEventListener("click", () => {
    btnTabRegister.classList.add("aktif");
    btnTabLogin.classList.remove("aktif");
    formRegister.classList.remove("sembunyi");
    formLogin.classList.add("sembunyi");
  });

  formLogin.addEventListener("submit", prosesLogin);
  formRegister.addEventListener("submit", prosesRegister);
  document.getElementById("btn-logout").addEventListener("click", prosesLogout);

  // Navigasi Sidebar
  document.querySelectorAll(".item-menu").forEach((btn) => {
    btn.addEventListener("click", () => pindahHalaman(btn.dataset.halaman, null));
  });

  // Sidebar Responsif HP
  document.getElementById("btn-buka-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("buka");
    document.getElementById("overlay-sidebar").classList.remove("sembunyi");
  });
  const tutupSidebarHp = () => {
    document.getElementById("sidebar").classList.remove("buka");
    document.getElementById("overlay-sidebar").classList.add("sembunyi");
  };
  document.getElementById("btn-tutup-sidebar").addEventListener("click", tutupSidebarHp);
  document.getElementById("overlay-sidebar").addEventListener("click", tutupSidebarHp);

  // Tombol Tambah Proyek & Tugas
  document.getElementById("btn-cepat-proyek").addEventListener("click", () => bukaModalProyek());
  document.getElementById("btn-sidebar-tambah-proyek").addEventListener("click", () => bukaModalProyek());
  document.getElementById("btn-tambah-proyek-baru").addEventListener("click", () => bukaModalProyek());
  document.getElementById("btn-cepat-tugas").addEventListener("click", () => bukaModalTugas());
  document.getElementById("btn-tambah-tugas-baru").addEventListener("click", () => bukaModalTugas());

  // Link dari Dashboard
  document.getElementById("btn-lihat-semua-tugas").addEventListener("click", () => pindahHalaman("tugas", null));
  document.getElementById("btn-lihat-semua-proyek").addEventListener("click", () => pindahHalaman("proyek", null));

  // Filter Proyek & Submit Form Proyek
  document.getElementById("cari-proyek").addEventListener("input", tampilkanDaftarProyek);
  document.getElementById("filter-status-proyek").addEventListener("change", tampilkanDaftarProyek);
  document.getElementById("form-proyek").addEventListener("submit", simpanProyek);

  // Tombol pada Banner Proyek Aktif
  document.getElementById("btn-kembali-proyek").addEventListener("click", () => pindahHalaman("proyek", null));
  document.getElementById("btn-edit-proyek-aktif").addEventListener("click", () => {
    if (proyekTerpilihId) bukaModalProyek(proyekTerpilihId);
  });
  document.getElementById("btn-hapus-proyek-aktif").addEventListener("click", () => {
    if (proyekTerpilihId) konfirmasiHapusProyek(proyekTerpilihId);
  });

  // Filter Tugas & Submit Form Tugas
  document.getElementById("cari-tugas").addEventListener("input", tampilkanTugas);
  document.getElementById("filter-proyek-tugas").addEventListener("change", tampilkanTugas);
  document.getElementById("filter-status-tugas").addEventListener("change", tampilkanTugas);
  document.getElementById("filter-deadline-tugas").addEventListener("change", tampilkanTugas);

  document.getElementById("btn-reset-filter").addEventListener("click", () => {
    document.getElementById("cari-tugas").value = "";
    if (!proyekTerpilihId) document.getElementById("filter-proyek-tugas").value = "SEMUA";
    document.getElementById("filter-status-tugas").value = "SEMUA";
    document.getElementById("filter-deadline-tugas").value = "SEMUA";
    tampilkanTugas();
  });

  document.getElementById("form-tugas").addEventListener("submit", simpanTugas);
  document.getElementById("input-lampiran-tugas").addEventListener("change", handleUploadLampiran);

  // Tombol Konfirmasi Hapus
  document.getElementById("btn-ya-hapus").addEventListener("click", () => {
    tutupModal("modal-konfirmasi");
    if (typeof aksiKonfirmasi === "function") {
      aksiKonfirmasi();
      aksiKonfirmasi = null;
    }
  });

  // Tutup Modal
  document.querySelectorAll(".tutup-modal").forEach((btn) => {
    btn.addEventListener("click", () => tutupModal(btn.dataset.tutup));
  });

  // Cek sesi login saat pertama kali web dibuka
  cekStatusLogin();
});
