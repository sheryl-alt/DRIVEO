/* Shared DRIVEO AI Recommendation logic.
   Semua halaman memakai endpoint dan aturan rekomendasi yang sama. */
(function () {
  const AI_API_URL = 'http://localhost:5000/api/ai/chat';
  const WHATSAPP_URL = 'https://wa.me/6281327099199';
  let requestInProgress = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[char];
    });
  }

  function renderAiText(value) {
    const source = String(value || '').replace(/\r\n?/g, '\n').trim();
    if (!source) return '<div class="ai-formatted-text"><p>Maaf, DRIVEO AI belum memberikan jawaban.</p></div>';

    const lines = source.split('\n');
    const output = [];
    let listOpen = false;
    const closeList = function () {
      if (listOpen) {
        output.push('</ul>');
        listOpen = false;
      }
    };

    function formatInline(raw) {
      let text = escapeHtml(raw);
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_match, label, url) {
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="text-red-600 underline font-medium">' + label + '</a>';
      });
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      return text;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        const tag = heading[1].length === 1 ? 'h3' : heading[1].length === 2 ? 'h4' : 'h5';
        output.push('<' + tag + ' class="font-bold text-sm mt-2 mb-1">' + formatInline(heading[2]) + '</' + tag + '>');
        continue;
      }
      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) {
        if (!listOpen) {
          output.push('<ul class="list-disc pl-5 my-2 space-y-1">');
          listOpen = true;
        }
        output.push('<li>' + formatInline(item[1]) + '</li>');
        continue;
      }
      closeList();
      output.push('<p class="mb-2">' + formatInline(line) + '</p>');
    }
    closeList();
    return '<div class="ai-formatted-text break-words">' + output.join('') + '</div>';
  }

  function getElements() {
    return {
      messages: document.getElementById('ai-chat-messages'),
      input: document.getElementById('aiChatInput')
    };
  }

  function addMessage(text, isUser) {
    const elements = getElements();
    if (!elements.messages) return null;

    const bubble = document.createElement('div');
    bubble.className = isUser
      ? 'flex justify-end gap-2.5 max-w-[90%] ml-auto'
      : 'flex gap-2.5 max-w-[90%]';

    if (isUser) {
      const message = document.createElement('div');
      message.className = 'bg-[#FF0000] text-white p-3 rounded-2xl rounded-tr-sm text-xs shadow-sm leading-relaxed font-medium break-words min-w-0';
      message.textContent = String(text || '');
      bubble.appendChild(message);
    } else {
      const avatar = document.createElement('img');
      avatar.src = '/images/driveo-ai-avatar-premium.png';
      avatar.alt = 'Avatar DRIVEO AI';
      avatar.className = 'w-7 h-7 rounded-full object-cover shrink-0 border border-[#E5E5E5]';
      avatar.width = 28;
      avatar.height = 28;

      const message = document.createElement('div');
      message.className = 'bg-white p-3 rounded-2xl rounded-tl-sm border border-[#E5E5E5] text-[#111111] shadow-sm leading-relaxed text-xs break-words min-w-0 overflow-hidden';
      message.innerHTML = renderAiText(text);
      bubble.appendChild(avatar);
      bubble.appendChild(message);
    }

    elements.messages.appendChild(bubble);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    return bubble;
  }

  function removeLoading(loader) {
    if (loader && loader.parentNode) loader.remove();
  }

  function normalizeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && /\/uploads?\//i.test(url.pathname)) {
          url.protocol = 'http:';
          url.host = 'localhost:5000';
        }
        return url.href;
      } catch (_) {
        return '';
      }
    }
    if (/^(data:|javascript:|blob:)/i.test(raw)) return '';
    return 'http://localhost:5000/' + raw.replace(/^\/+/, '');
  }

  function createSpecBadge(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const badge = document.createElement('span');
    badge.className = 'inline-flex items-center rounded-full border border-[#E5E5E5] bg-[#F8F8F8] px-2 py-1 text-[10px] text-[#555555]';
    badge.textContent = String(value);
    return badge;
  }

  function createRecommendationCard(car) {
    const card = document.createElement('div');
    card.className = 'mt-3 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white';

    const imageUrl = normalizeImageUrl(car.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = car.name || 'Foto kendaraan DRIVEO';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.className = 'block h-36 w-full object-cover';
      card.appendChild(image);
    }

    const body = document.createElement('div');
    body.className = 'p-3';

    const name = document.createElement('div');
    name.className = 'text-sm font-bold text-[#111111]';
    name.textContent = car.name || 'Kendaraan DRIVEO';
    body.appendChild(name);

    const price = document.createElement('div');
    price.className = 'mt-1 text-base font-extrabold text-[#111111]';
    price.textContent = car.priceFormatted || 'Harga belum tersedia';
    body.appendChild(price);

    const specs = document.createElement('div');
    specs.className = 'mt-2 flex flex-wrap gap-1.5';
    [car.year, car.transmission, car.fuel].forEach((value) => {
      const badge = createSpecBadge(value);
      if (badge) specs.appendChild(badge);
    });
    if (specs.childElementCount) body.appendChild(specs);

    const reasonTitle = document.createElement('div');
    reasonTitle.className = 'mt-3 text-[11px] font-bold text-[#111111]';
    reasonTitle.textContent = 'Alasan rekomendasi';
    body.appendChild(reasonTitle);

    const reason = document.createElement('p');
    reason.className = 'mt-1 text-[11px] leading-relaxed text-[#555555]';
    reason.textContent = car.reason || 'Kendaraan ini dipilih berdasarkan kriteria yang dapat diverifikasi dari data katalog DRIVEO.';
    body.appendChild(reason);

    const detail = document.createElement('a');
    detail.href = '/detail-mobil?id=' + encodeURIComponent(String(car.id));
    detail.target = '_top';
    detail.rel = 'noopener';
    detail.className = 'mt-3 inline-flex w-full items-center justify-center rounded-lg bg-[#FF0000] px-3 py-2.5 text-xs font-semibold text-white';
    detail.textContent = 'Lihat Detail Mobil';
    body.appendChild(detail);

    card.appendChild(body);
    return card;
  }

  function addRecommendationMessage(result) {
    const bubble = addMessage(result.intro || 'Berikut hasil analisis kebutuhan kendaraan Anda.', false);
    if (!bubble) return;
    const content = bubble.querySelector('.ai-formatted-text');
    if (!content) return;

    const recommendations = Array.isArray(result.recommendations) ? result.recommendations.slice(0, 2) : [];
    recommendations.forEach((car) => content.appendChild(createRecommendationCard(car)));

    if (recommendations.length) {
      const actions = document.createElement('div');
      actions.className = 'mt-3 grid grid-cols-1 gap-2';

      const names = recommendations.map((car) => car.name).filter(Boolean).join(' dan ');
      const message = 'Halo DRIVEO, saya ingin konsultasi lebih lanjut mengenai ' + (names || 'rekomendasi kendaraan') + '.';
      const consult = document.createElement('a');
      consult.href = WHATSAPP_URL + '?text=' + encodeURIComponent(message);
      consult.target = '_blank';
      consult.rel = 'noopener noreferrer';
      consult.className = 'inline-flex w-full items-center justify-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-xs font-semibold text-[#222222]';
      consult.textContent = 'Konsultasi Lebih Lanjut';
      actions.appendChild(consult);

      const catalog = document.createElement('a');
      catalog.href = '/katalog';
      catalog.target = '_top';
      catalog.rel = 'noopener';
      catalog.className = 'inline-flex w-full items-center justify-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-xs font-semibold text-[#222222]';
      catalog.textContent = 'Cari Rekomendasi Lain';
      actions.appendChild(catalog);
      content.appendChild(actions);
    }

    const messages = getElements().messages;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  function getErrorMessage(response, result) {
    const message = String(result?.message || '');
    if (response.status === 503) return message || 'Data katalog atau layanan rekomendasi sedang tidak tersedia. Silakan coba kembali.';
    if (response.status === 429) return message || 'Permintaan AI sedang dibatasi. Tunggu sebentar sebelum mencoba lagi.';
    if (response.status === 502) return message || 'Gemini belum berhasil memberikan rekomendasi. Periksa model, API key, dan kuota.';
    if (response.status === 500) return message || 'Terjadi kesalahan pada backend DRIVEO. Periksa terminal backend.';
    if (response.status === 404) return 'Endpoint rekomendasi AI tidak ditemukan. Periksa rute API backend DRIVEO.';
    if (response.status === 403) return message || 'Akses AI ditolak. Periksa konfigurasi API key Gemini.';
    if (response.status === 400) return message || 'Kebutuhan kendaraan tidak valid. Silakan coba lagi.';
    return message || 'DRIVEO AI belum dapat memproses rekomendasi. Silakan coba kembali.';
  }

  async function askGemini(message) {
    const userMessage = String(message || '').trim();
    if (!userMessage || requestInProgress) return;

    requestInProgress = true;
    addMessage(userMessage, true);
    const loader = addMessage('Sedang menganalisis kebutuhan kendaraan...', false);
    const elements = getElements();
    if (elements.input) elements.input.disabled = true;

    const timeoutController = new AbortController();
    const timeoutId = window.setTimeout(() => timeoutController.abort(), 30000);

    try {
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
        signal: timeoutController.signal
      });
      let result = {};
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result.success === false) throw new Error(getErrorMessage(response, result));

      removeLoading(loader);
      const recommendation = result.result || {};
      if (recommendation.type === 'match' || recommendation.type === 'alternative') {
        addRecommendationMessage(recommendation, userMessage);
      } else {
        addMessage(recommendation.intro || 'Belum ada rekomendasi yang dapat ditampilkan.', false);
      }
    } catch (error) {
      console.error('DRIVEO AI Recommendation error:', error);
      removeLoading(loader);
      const messageText = error.name === 'AbortError'
        ? 'Analisis membutuhkan waktu lebih lama dari biasanya. Silakan coba kembali.'
        : (error.message || 'Layanan rekomendasi sedang mengalami gangguan.');
      addMessage(messageText, false);
    } finally {
      window.clearTimeout(timeoutId);
      requestInProgress = false;
      if (elements.input) {
        elements.input.disabled = false;
        elements.input.focus();
      }
    }
  }

  // Fungsi publik dipertahankan agar tombol pilihan cepat yang sudah ada tetap berfungsi.
  window.handleAiPrompt = function (userText) {
    const topic = String(userText || '').trim();
    const prompts = {
      'Mobil Keluarga': 'Saya membutuhkan mobil keluarga. Tolong analisis kebutuhan saya dan rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.',
      'Mobil Harian': 'Saya mencari mobil untuk penggunaan harian. Tolong analisis kebutuhan saya dan rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.',
      'SUV atau MPV': 'Saya ingin mempertimbangkan mobil SUV atau MPV. Tolong rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.'
    };
    askGemini(prompts[topic] || topic);
  };

  window.handleDriveoAiPrompt = function (topic) {
    const prompts = {
      keluarga: 'Saya membutuhkan mobil keluarga. Tolong rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.',
      harian: 'Saya mencari mobil untuk penggunaan harian. Tolong rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.',
      suv: 'Saya mencari mobil SUV. Tolong rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.',
      mpv: 'Saya mencari mobil MPV. Tolong rekomendasikan kendaraan yang paling sesuai dari katalog DRIVEO.'
    };
    askGemini(prompts[String(topic || '').toLowerCase()] || String(topic || 'Saya ingin mencari mobil yang sesuai dengan kebutuhan saya.'));
  };

  window.handleDriveoAiSubmit = function () {
    const input = document.getElementById('aiChatInput');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    askGemini(value);
  };

  window.submitCustomAiMessage = window.handleDriveoAiSubmit;
  window.handleQuickAi = function (prompt) { askGemini(String(prompt || '').trim()); };
  window.sendAiMessage = window.handleDriveoAiSubmit;
})();
