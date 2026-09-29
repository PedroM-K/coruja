/**
 * OBLÍVIO RPG - Ficha de Persona Interativa
 * Gerenciador de Fichas Local (localStorage / Cache sem necessidade de banco de dados)
 * Sistema de regras, rolagens com Zona de Acerto, rastreamento corporal de estresse e inventário.
 * Visual rico, interativo, com efeitos visuais e sonoros procedurais.
 */

(function () {
  'use strict';

  // --- Chaves do LocalStorage ---
  const STORAGE_KEY_SHEETS = 'oblivio_rpg_sheets_v1';
  const STORAGE_KEY_ACTIVE = 'oblivio_rpg_active_id_v1';
  const STORAGE_KEY_HISTORY = 'oblivio_rpg_history_v1';
  const STORAGE_KEY_SOUND = 'oblivio_rpg_sound_v1';

  // --- Estrutura Padrão de Ficha ---
  function createDefaultSheet(name = 'Nova persona') {
    return {
      id: 'sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name,
      motivation: '',
      player: '',
      role: 'Quem Age',
      avatar: 'assets/default-avatar.svg',
      ap: 0,
      ev: 0,
      initialAbility: null,
      abilities: [],
      stress: {
        armRight: { cur: 0, max: 0, checked: false },
        armLeft: { cur: 0, max: 0, checked: false },
        torso: { cur: 0, max: 0, checked: false },
        legRight: { cur: 0, max: 0, checked: false },
        legLeft: { cur: 0, max: 0, checked: false }
      },
      attributes: {
        carne: 0,
        forca: 0,
        prontidao: 0,
        determinacao: 0,
        mente: 0,
        coragem: 0,
        dano: 0,
        folego: 0,
        protecao: 0,
        velocidade: 0
      },
      zona: 'normal', // 'reduzida' | 'normal' | 'aumentada'
      inventory: {
        carregados: [],
        guardados: [],
        slotsUsed: [false, false, false, false, false]
      },
      knowledge: [],
      mazelas: [],
      notes: ''
    };
  }

  // --- Estado Global da Aplicação ---
  const state = {
    sheets: [],
    activeSheetId: null,
    history: [],
    selectedDiceType: 20,
    saveDebounceTimer: null,
    cinematicTimer: null,
    diceRollInterval: null
  };

  // --- Inicialização da Aplicação ---
  function initApp() {
    initParticlesBackground();
    loadSoundPref();
    loadRollHistory();
    loadSheetsFromStorage();
    setupEventListeners();
    renderAll();
  }

  // --- Efeito de Partículas Etéreas de Fundo ---
  function initParticlesBackground() {
    const canvas = document.getElementById('bg-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const particleCount = Math.min(45, Math.floor(width / 35));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.45 - 0.15,
        alpha: Math.random() * 0.45 + 0.15,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        color: Math.random() > 0.4 ? '250, 204, 21' : '168, 85, 247' // Dourado ou Roxo arcano
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.004;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${Math.max(0.05, Math.min(0.6, p.alpha))})`;
        ctx.shadowBlur = p.radius * 4;
        ctx.shadowColor = `rgba(${p.color}, 0.8)`;
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // --- Preferências de Som ---
  function loadSoundPref() {
    const saved = localStorage.getItem(STORAGE_KEY_SOUND);
    if (saved !== null && window.soundFX) {
      window.soundFX.muted = saved === 'true';
      updateSoundIcon();
    }
  }

  function updateSoundIcon() {
    const icon = document.getElementById('sound-icon');
    if (icon && window.soundFX) {
      icon.textContent = window.soundFX.muted ? 'SOM OFF' : 'SOM ON';
    }
  }

  // --- Histórico de Rolagens ---
  function loadRollHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        state.history = JSON.parse(saved);
      }
    } catch (e) {
      state.history = [];
    }
  }

  function saveRollHistory() {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history.slice(0, 100)));
    } catch (e) {}
  }

  function addHistoryEntry(entry) {
    const current = getActiveSheet();
    const item = {
      id: 'hist_' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      personaName: current ? current.name : 'Persona',
      title: entry.title || 'Rolagem',
      total: entry.total,
      formula: entry.formula,
      zonaText: entry.zonaText,
      verdict: entry.verdict,
      verdictColor: entry.verdictColor || '#ffffff',
      typeClass: entry.typeClass || 'normal'
    };

    state.history.unshift(item);
    if (state.history.length > 100) state.history.pop();
    saveRollHistory();
  }

  // --- Carregamento e Persistência de Fichas ---
  function loadSheetsFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHEETS);
      if (saved) {
        state.sheets = JSON.parse(saved);
      }
    } catch (e) {
      state.sheets = [];
    }

    if (!Array.isArray(state.sheets) || state.sheets.length === 0) {
      const defaultSheet = createDefaultSheet();
      state.sheets = [defaultSheet];
      state.activeSheetId = defaultSheet.id;
      saveSheetsToStorage();
    } else {
      // Garantir compatibilidade e campos estruturais
      state.sheets.forEach(sheet => {
        if (!sheet) return;
        if (!sheet.avatar || sheet.avatar.startsWith('assets/avatar-') || sheet.avatar.endsWith('avatar-sigil.svg')) {
          sheet.avatar = 'assets/default-avatar.svg';
        }
        if (!sheet.stress) {
          sheet.stress = {
            armRight: { cur: 0, max: 0, checked: false },
            armLeft: { cur: 0, max: 0, checked: false },
            torso: { cur: 0, max: 0, checked: false },
            legRight: { cur: 0, max: 0, checked: false },
            legLeft: { cur: 0, max: 0, checked: false }
          };
        }
        if (!sheet.inventory) {
          sheet.inventory = { carregados: [], guardados: [], slotsUsed: [false, false, false, false, false] };
        }
        if (!Array.isArray(sheet.inventory.slotsUsed)) {
          sheet.inventory.slotsUsed = [false, false, false, false, false];
        }
        if (!sheet.attributes) {
          sheet.attributes = {
            carne: 0,
            forca: 0,
            prontidao: 0,
            determinacao: 0,
            mente: 0,
            coragem: 0,
            dano: 0,
            folego: 0,
            protecao: 0,
            velocidade: 0
          };
        } else {
          const allAttrs = ['carne', 'forca', 'prontidao', 'determinacao', 'mente', 'coragem', 'dano', 'folego', 'protecao', 'velocidade'];
          allAttrs.forEach(a => {
            if (sheet.attributes[a] === undefined) sheet.attributes[a] = 0;
          });
        }
      });

      const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
      if (activeId && state.sheets.some(s => s.id === activeId)) {
        state.activeSheetId = activeId;
      } else {
        state.activeSheetId = state.sheets[0].id;
      }
    }
  }

  function saveSheetsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(state.sheets));
      if (state.activeSheetId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, state.activeSheetId);
      }
      showSaveIndicator();
    } catch (e) {
      console.error('Erro ao salvar ficha no localStorage:', e);
    }
  }

  function triggerAutoSave() {
    clearTimeout(state.saveDebounceTimer);
    state.saveDebounceTimer = setTimeout(() => {
      saveSheetsToStorage();
    }, 300);
  }

  function showSaveIndicator() {
    const statusText = document.getElementById('status-text');
    const syncStatus = document.getElementById('sync-status');
    if (!statusText || !syncStatus) return;

    statusText.textContent = 'Salvo no cache ✓';
    syncStatus.style.borderColor = 'rgba(250, 204, 21, 0.6)';
    setTimeout(() => {
      statusText.textContent = 'Salvo localmente';
      syncStatus.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    }, 1800);
  }

  function getActiveSheet() {
    return state.sheets.find(s => s.id === state.activeSheetId) || state.sheets[0];
  }

  // --- Renderização Completa ---
  function renderAll() {
    renderSheetSelector();
    renderPersona();
    renderActionsAndEvolutions();
    renderAbilities();
    renderStress();
    renderAttributes();
    renderZonaAcerto();
    renderInventory();
    renderKnowledge();
    renderMazelas();
    renderNotes();
    renderHistoryModal();
  }

  // --- Render: Seletor de Fichas ---
  function renderSheetSelector() {
    const select = document.getElementById('sheet-select');
    if (!select) return;

    select.innerHTML = '';
    state.sheets.forEach(sheet => {
      const opt = document.createElement('option');
      opt.value = sheet.id;
      opt.textContent = sheet.name || 'Sem Nome';
      if (sheet.id === state.activeSheetId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  // --- Render: Persona & Avatar ---
  function renderPersona() {
    const s = getActiveSheet();
    const nameEl = document.getElementById('persona-name');
    const motEl = document.getElementById('persona-motivation');
    const playerEl = document.getElementById('persona-player');
    const roleEl = document.getElementById('persona-role');
    const avatarEl = document.getElementById('persona-avatar-img');

    if (nameEl) nameEl.value = s.name || '';
    if (motEl) motEl.value = s.motivation || '';
    if (playerEl) playerEl.value = s.player || '';
    if (avatarEl) avatarEl.src = s.avatar || 'assets/default-avatar.svg';

    if (roleEl) {
      let matched = false;
      for (let i = 0; i < roleEl.options.length; i++) {
        if (roleEl.options[i].value === s.role) {
          roleEl.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched && s.role) {
        let customOpt = roleEl.querySelector('option[data-custom="true"]');
        if (!customOpt) {
          customOpt = document.createElement('option');
          customOpt.setAttribute('data-custom', 'true');
          roleEl.insertBefore(customOpt, roleEl.lastElementChild);
        }
        customOpt.value = s.role;
        customOpt.textContent = s.role;
        customOpt.selected = true;
      }
    }
  }

  // --- Render: Ações e Evoluções ---
  function renderActionsAndEvolutions() {
    const s = getActiveSheet();
    const apEl = document.getElementById('persona-ap');
    const evEl = document.getElementById('persona-ev');
    if (apEl) apEl.value = s.ap ?? 0;
    if (evEl) evEl.value = s.ev ?? 0;
  }

  // --- Render: Habilidades ---
  function renderAbilities() {
    const s = getActiveSheet();

    // Habilidade Inicial
    const initDisplay = document.getElementById('initial-ability-display');
    const initEmpty = document.getElementById('initial-ability-empty');
    const initName = document.getElementById('initial-ability-name');
    const initType = document.getElementById('initial-ability-type');
    const initDesc = document.getElementById('initial-ability-desc');

    const hasInitial = !!(s.initialAbility && s.initialAbility.name && s.initialAbility.name.trim() !== '');
    if (initDisplay) initDisplay.style.display = hasInitial ? 'block' : 'none';
    if (initEmpty) initEmpty.style.display = hasInitial ? 'none' : 'block';

    if (hasInitial) {
      if (initName) initName.textContent = s.initialAbility.name;
      if (initType) initType.textContent = s.initialAbility.type || '';
      if (initDesc) initDesc.textContent = s.initialAbility.desc || '';
    }

    // Lista de Habilidades Únicas e Gerais
    const listEl = document.getElementById('abilities-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!s.abilities || s.abilities.length === 0) {
      listEl.innerHTML = '<div class="empty-state-notice">Nenhuma habilidade adicionada ainda. Clique em + para criar.</div>';
      return;
    }

    s.abilities.forEach(ab => {
      const item = document.createElement('div');
      item.className = 'ability-item';
      item.innerHTML = `
        <div class="ability-header">
          <div>
            <span class="ability-name">${escapeHtml(ab.name)}</span>
            <span class="ability-type" style="margin-left:6px;">${escapeHtml(ab.type || '')} ${ab.cost ? '• ' + escapeHtml(ab.cost) : ''}</span>
          </div>
          <div class="ability-actions">
            <button class="btn-sm-action edit" data-id="${ab.id}" title="Editar">✎</button>
            <button class="btn-sm-action delete" data-id="${ab.id}" title="Remover">✕</button>
          </div>
        </div>
        <div class="ability-body" style="border-top:none; padding-top:2px;">
          ${escapeHtml(ab.desc || '')}
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  // --- Render: Estresse & Silhueta Corporal ---
  function renderStress() {
    const s = getActiveSheet();
    const limbs = ['armRight', 'armLeft', 'torso', 'legRight', 'legLeft'];

    limbs.forEach(limb => {
      const data = s.stress[limb] || { cur: 0, max: 0, checked: false };
      const curEl = document.getElementById(`val-${limb}-cur`);
      const maxEl = document.getElementById(`val-${limb}-max`);
      const meterEl = document.getElementById(`meter-${limb}`);

      if (curEl) curEl.textContent = data.cur;
      if (maxEl) maxEl.textContent = data.max;

      // Barra de Estresse visual
      if (meterEl) {
        let percent = 0;
        if (data.checked) percent = 100;
        else if (data.max > 0) percent = Math.min(100, Math.round((data.cur / data.max) * 100));
        else if (data.cur > 0) percent = 100;
        meterEl.style.width = percent + '%';
      }

      // Checkbox
      const kebabName = limbToKebab(limb);
      const chkEl = document.getElementById(`check-${kebabName}`);
      if (chkEl) chkEl.checked = !!data.checked;

      // Silhueta SVG state
      updateSilhouetteLimbState(kebabName, data);
    });
  }

  function limbToKebab(camel) {
    if (camel === 'armRight') return 'arm-right';
    if (camel === 'armLeft') return 'arm-left';
    if (camel === 'legRight') return 'leg-right';
    if (camel === 'legLeft') return 'leg-left';
    return camel; // torso
  }

  function updateSilhouetteLimbState(kebabLimb, data) {
    if (!data) return;
    const limbGroups = document.querySelectorAll(`.body-limb[data-limb="${kebabLimb}"]`);
    if (!limbGroups || limbGroups.length === 0) return;

    let ratio = 0;
    if (data.checked) {
      ratio = 1;
    } else if (data.max > 0) {
      ratio = Math.min(1, Math.max(0, (data.cur || 0) / data.max));
    } else if ((data.cur || 0) > 0) {
      ratio = 1;
    }

    // No tema sombrio: Grafite/Slate Anatômico (#222638) no estado normal
    // Conforme o estresse aumenta ou se estiver lesionado, transiciona para Vermelho Sangue (#dc2626)
    const r = Math.round(34 + ratio * (220 - 34));
    const g = Math.round(38 + ratio * (38 - 38));
    const b = Math.round(56 + ratio * (38 - 56));
    const fillColor = ratio === 0 ? '#222638' : `rgb(${r}, ${g}, ${b})`;

    limbGroups.forEach(group => {
      const path = group.querySelector('.limb-path');
      if (path) {
        path.style.fill = fillColor;
        if (ratio >= 0.75 || data.checked) {
          path.style.stroke = '#ffffff';
          path.style.filter = `drop-shadow(0 0 ${Math.round(4 + ratio * 8)}px rgba(220, 38, 38, 0.95))`;
        } else if (ratio > 0.25) {
          path.style.stroke = 'rgba(220, 38, 38, 0.7)';
          path.style.filter = 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.5))';
        } else {
          path.style.stroke = '#3e445f';
          path.style.filter = 'none';
        }
      }

      if (ratio >= 1 || data.checked) {
        group.classList.add('critical-hit');
      } else {
        group.classList.remove('critical-hit');
      }
    });
  }

  // --- Render: Atributos & Metades ---
  function renderAttributes() {
    const s = getActiveSheet();
    if (!s || !s.attributes) return;

    const fixedAttrs = ['carne', 'forca', 'prontidao', 'determinacao', 'mente'];
    const mutableAttrs = ['coragem', 'dano', 'folego', 'protecao', 'velocidade'];

    // Atributos Fixos (possuem valor e botão de Metade)
    fixedAttrs.forEach(attr => {
      const fixedVal = Number(s.attributes[attr] ?? 0);
      const halfVal = Math.floor(fixedVal / 2);

      const valEl = document.getElementById(`val-attr-${attr}`);
      if (valEl) {
        valEl.textContent = fixedVal;
      }

      const halfEl = document.getElementById(`val-attr-${attr}-half`);
      if (halfEl) {
        halfEl.textContent = halfVal;
      }
    });

    // Atributos Mutáveis (modelo anterior com stepper e rolagem)
    mutableAttrs.forEach(attr => {
      const mutVal = Number(s.attributes[attr] ?? 0);
      const valEl = document.getElementById(`val-attr-${attr}`);
      if (valEl) {
        valEl.textContent = mutVal;
      }
    });
  }

  // --- Render: Zona de Acerto ---
  function renderZonaAcerto() {
    const s = getActiveSheet();
    const zona = s.zona || 'normal';
    document.querySelectorAll('.btn-zona').forEach(btn => {
      const isTarget = btn.dataset.zona === zona;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-checked', isTarget ? 'true' : 'false');
    });

    const hintEl = document.getElementById('zona-dc-hint');
    if (hintEl) {
      if (zona === 'reduzida') hintEl.textContent = 'Dificuldade Atual: 10+ (Reduzida)';
      else if (zona === 'aumentada') hintEl.textContent = 'Dificuldade Atual: 16+ (Aumentada)';
      else hintEl.textContent = 'Dificuldade Atual: 13+ (Normal)';
    }

    const diceZonaSelect = document.getElementById('dice-target-zona');
    if (diceZonaSelect) {
      diceZonaSelect.value = zona;
    }
  }

  // --- Cálculo de Capacidade e Carga do Inventário ---
  // Regra Oficial: 5 + o seu atributo de Carne ou Força (ou 1, o que for maior)
  // Carga Total: soma dos pesos/burden de todos os itens (aumenta/diminui automaticamente)
  function calculateInventoryMetrics(sheet) {
    const s = sheet || getActiveSheet();
    if (!s) return { currentWeight: 0, maxCapacity: 6, forca: 0, carne: 0, isOverencumbered: false, freeSlots: 6, overSlots: 0 };

    const forca = Number(s.attributes?.forca) || 0;
    const carne = Number(s.attributes?.carne) || 0;
    const attrBonus = Math.max(forca, carne, 1);
    const maxCapacity = 5 + attrBonus;

    let currentWeight = 0;
    if (s.inventory) {
      if (Array.isArray(s.inventory.carregados)) {
        s.inventory.carregados.forEach(i => {
          const b = Number(i.burden);
          currentWeight += (!isNaN(b) && b >= 0) ? b : 1;
        });
      }
      if (Array.isArray(s.inventory.guardados)) {
        s.inventory.guardados.forEach(i => {
          const b = Number(i.burden);
          currentWeight += (!isNaN(b) && b >= 0) ? b : 1;
        });
      }
    }

    const isOverencumbered = currentWeight > maxCapacity;
    return {
      currentWeight,
      maxCapacity,
      forca,
      carne,
      isOverencumbered,
      freeSlots: Math.max(0, maxCapacity - currentWeight),
      overSlots: Math.max(0, currentWeight - maxCapacity)
    };
  }

  // --- Render: Inventário ---
  function renderInventory() {
    const s = getActiveSheet();
    if (!s) return;

    if (!s.inventory) {
      s.inventory = { carregados: [], guardados: [] };
    }
    if (!Array.isArray(s.inventory.carregados)) s.inventory.carregados = [];
    if (!Array.isArray(s.inventory.guardados)) s.inventory.guardados = [];

    const metrics = calculateInventoryMetrics(s);

    // Atualiza Painel de Capacidade
    const totalEl = document.getElementById('inventory-weight-total');
    const maxEl = document.getElementById('inventory-capacity-max');
    const badgeEl = document.getElementById('inventory-encumbrance-badge');
    const barEl = document.getElementById('inventory-capacity-bar');
    const slotsBoxes = document.getElementById('slots-boxes');

    if (totalEl) totalEl.textContent = metrics.currentWeight;
    if (maxEl) maxEl.textContent = metrics.maxCapacity;

    if (badgeEl) {
      if (metrics.isOverencumbered) {
        badgeEl.textContent = `SOBRECARREGADO (+${metrics.overSlots})`;
        badgeEl.className = 'encumbrance-badge danger';
      } else if (metrics.currentWeight === metrics.maxCapacity) {
        badgeEl.textContent = 'Capacidade Cheia';
        badgeEl.className = 'encumbrance-badge warning';
      } else {
        badgeEl.textContent = `${metrics.freeSlots} Livres`;
        badgeEl.className = 'encumbrance-badge safe';
      }
    }

    if (barEl) {
      const pct = Math.min(100, Math.round((metrics.currentWeight / (metrics.maxCapacity || 1)) * 100));
      barEl.style.width = `${pct}%`;
      if (metrics.isOverencumbered) {
        barEl.style.background = 'linear-gradient(90deg, #facc15 0%, #ef4444 100%)';
      } else {
        barEl.style.background = 'linear-gradient(90deg, #10b981 0%, #facc15 100%)';
      }
    }

    // Render Caixas de Slots (1 caixa para cada ponto de capacidade máxima + caixas vermelhas se sobrecarregado)
    if (slotsBoxes) {
      slotsBoxes.innerHTML = '';
      const totalBoxes = Math.max(metrics.maxCapacity, metrics.currentWeight);
      for (let i = 0; i < totalBoxes; i++) {
        const box = document.createElement('div');
        const isFilled = i < metrics.currentWeight;
        const isOver = i >= metrics.maxCapacity && isFilled;

        box.className = 'slot-box' + (isFilled ? ' used' : '') + (isOver ? ' overencumbered' : '');
        box.title = isOver 
          ? `Espaço Excedente ${i + 1} (Sobrepeso)` 
          : `Espaço ${i + 1} de ${metrics.maxCapacity}: ${isFilled ? 'Ocupado' : 'Livre'}`;
        slotsBoxes.appendChild(box);
      }
    }

    // Carregados
    const tbodyCarregados = document.getElementById('tbody-carregados');
    if (tbodyCarregados) {
      tbodyCarregados.innerHTML = '';
      if (s.inventory.carregados.length === 0) {
        tbodyCarregados.innerHTML = `<tr><td colspan="6" class="empty-state-notice">Nenhum item carregado. Clique abaixo para adicionar armas ou itens prontos.</td></tr>`;
      } else {
        s.inventory.carregados.forEach(item => {
          const tr = document.createElement('tr');
          const burdenVal = item.burden !== undefined ? item.burden : 1;
          tr.innerHTML = `
            <td><button class="btn-use-item" data-id="${item.id}" title="Usar item">USAR</button></td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>
              ${item.damage ? `<button class="btn-roll-dmg" data-dmg="${escapeHtml(item.damage)}" data-name="${escapeHtml(item.name)}" title="Rolar dano da arma">${escapeHtml(item.damage)}</button>` : '-'}
            </td>
            <td><span class="badge-burden" title="Carga / Peso">${escapeHtml(String(burdenVal))}</span></td>
            <td>${escapeHtml(item.stress || '0')}</td>
            <td>
              <button class="btn-sm-action edit-item" data-id="${item.id}" data-cat="carregado" title="Editar item">✎</button>
              <button class="btn-sm-action delete-item" data-id="${item.id}" data-cat="carregado" title="Remover item">✕</button>
            </td>
          `;
          tbodyCarregados.appendChild(tr);
        });
      }
    }

    // Guardados
    const tbodyGuardados = document.getElementById('tbody-guardados');
    if (tbodyGuardados) {
      tbodyGuardados.innerHTML = '';
      if (s.inventory.guardados.length === 0) {
        tbodyGuardados.innerHTML = `<tr><td colspan="5" class="empty-state-notice">Nenhum item guardado na mochila.</td></tr>`;
      } else {
        s.inventory.guardados.forEach(item => {
          const tr = document.createElement('tr');
          const burdenVal = item.burden !== undefined ? item.burden : 1;
          tr.innerHTML = `
            <td><span class="badge-tag">${escapeHtml(item.type || 'Geral')}</span></td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td><span class="badge-burden" title="Carga / Peso">${escapeHtml(String(burdenVal))}</span></td>
            <td>${escapeHtml(item.uses || '-')}</td>
            <td>
              <button class="btn-sm-action edit-item" data-id="${item.id}" data-cat="guardado" title="Editar item">✎</button>
              <button class="btn-sm-action delete-item" data-id="${item.id}" data-cat="guardado" title="Remover item">✕</button>
            </td>
          `;
          tbodyGuardados.appendChild(tr);
        });
      }
    }
  }

  // --- Render: Conhecimentos ---
  function renderKnowledge() {
    const s = getActiveSheet();
    const listEl = document.getElementById('knowledge-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!s.knowledge || s.knowledge.length === 0) {
      listEl.innerHTML = '<div class="empty-state-notice">Nenhum conhecimento registrado. Clique em + para adicionar saberes ou perícias.</div>';
      return;
    }

    s.knowledge.forEach(kn => {
      const item = document.createElement('div');
      item.className = 'knowledge-item';
      item.innerHTML = `
        <div class="knowledge-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn-attr-roll btn-roll-knowledge" data-attr="${kn.attr}" data-bonus="${kn.bonus || 0}" data-name="${escapeHtml(kn.name)}" title="Testar Conhecimento (1d20 + Atributo + Bônus)">
              <strong>${escapeHtml(kn.name)}</strong>
            </button>
            <span class="badge-tag badge-${kn.attr}">${(kn.attr || '').toUpperCase()} ${kn.bonus >= 0 ? '+' : ''}${kn.bonus || 0}</span>
          </div>
          <div class="ability-actions">
            <button class="btn-sm-action delete-knowledge" data-id="${kn.id}" title="Remover">✕</button>
          </div>
        </div>
        ${kn.desc ? `<div class="ability-body" style="border:none; padding:0; font-size:0.78rem;">${escapeHtml(kn.desc)}</div>` : ''}
      `;
      listEl.appendChild(item);
    });
  }

  // --- Render: Mazelas ---
  function renderMazelas() {
    const s = getActiveSheet();
    const listEl = document.getElementById('mazelas-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!s.mazelas || s.mazelas.length === 0) {
      listEl.innerHTML = '<div class="empty-state-notice">Nenhuma mazela ou trauma registrado. A mente e corpo ainda resistem.</div>';
      return;
    }

    s.mazelas.forEach(mz => {
      const item = document.createElement('div');
      item.className = 'mazela-item';
      item.innerHTML = `
        <div class="mazela-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="mazela-name">${escapeHtml(mz.name)}</span>
            <span class="badge-tag badge-severity-${mz.severity || 'Média'}">${escapeHtml(mz.severity || 'Média')}</span>
            <span class="badge-tag">${escapeHtml(mz.type || 'Geral')}</span>
          </div>
          <div class="ability-actions">
            <button class="btn-sm-action delete-mazela" data-id="${mz.id}" title="Remover">✕</button>
          </div>
        </div>
        <div class="ability-body" style="border:none; padding:0; color:#fca5a5;">
          ${escapeHtml(mz.desc || '')}
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  // --- Render: Notas ---
  function renderNotes() {
    const s = getActiveSheet();
    const notesEl = document.getElementById('persona-notes');
    if (notesEl) {
      notesEl.value = s.notes || '';
    }
  }

  // --- Render: Modal de Histórico ---
  function renderHistoryModal() {
    const list = document.getElementById('history-log-list');
    if (!list) return;

    list.innerHTML = '';
    if (state.history.length === 0) {
      list.innerHTML = '<div class="empty-state-notice">Nenhuma rolagem realizada ainda nesta sessão.</div>';
      return;
    }

    state.history.forEach(h => {
      const div = document.createElement('div');
      div.className = `history-log-item hist-${h.typeClass || 'normal'}`;
      div.innerHTML = `
        <div class="history-meta-row">
          <span>${escapeHtml(h.timestamp)} • ${escapeHtml(h.personaName)}</span>
          <span>${escapeHtml(h.zonaText || '')}</span>
        </div>
        <div class="history-main-row">
          <span class="history-title">${escapeHtml(h.title)}</span>
          <span style="font-size:1.1rem; font-family:var(--font-serif); font-weight:900; color:${h.verdictColor || '#ffffff'};">${escapeHtml(String(h.total))}</span>
        </div>
        <div style="font-size:0.74rem; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(h.formula || '')}</div>
        <div style="font-size:0.8rem; font-weight:bold; color:${h.verdictColor || '#ffffff'};">${escapeHtml(h.verdict || '')}</div>
      `;
      list.appendChild(div);
    });
  }

  // ==========================================================================
  // SISTEMA DE REGRAS DE ROLAGEM DO OBLÍVIO RPG
  // ==========================================================================
  function evaluateOblivioRoll(naturalD20, finalTotal, zonaKey) {
    if (naturalD20 === 1) {
      return {
        verdict: 'FALHA EXTREMA (Natural 1)',
        color: '#ef4444',
        typeClass: 'falha-extrema'
      };
    }
    if (naturalD20 === 20) {
      return {
        verdict: 'SUCESSO EXTREMO (Natural 20)',
        color: '#facc15',
        typeClass: 'sucesso-extremo'
      };
    }

    let threshold = 13;
    if (zonaKey === 'reduzida') threshold = 10;
    if (zonaKey === 'aumentada') threshold = 16;

    if (finalTotal >= threshold) {
      return {
        verdict: `SUCESSO REGULAR (Meta: ${threshold}+)`,
        color: '#10b981',
        typeClass: 'sucesso'
      };
    } else {
      return {
        verdict: `FALHA REGULAR (Meta: ${threshold}+)`,
        color: '#f97316',
        typeClass: 'falha'
      };
    }
  }

  // --- Efeito de Rolagem Cinemática ---
  function triggerCinematicRoll({ title, total, formula, verdict, verdictColor, typeClass, die = 20, dieVal }) {
    const stage = document.getElementById('cinematic-dice-stage');
    const actor = document.getElementById('dice-3d-actor');
    const burst = document.getElementById('dice-impact-burst');
    const titleEl = document.getElementById('cinematic-title');
    const totalEl = document.getElementById('cinematic-total');
    const formulaEl = document.getElementById('cinematic-formula');
    const verdictEl = document.getElementById('cinematic-verdict');
    const actorValEl = document.getElementById('dice-actor-val');

    if (!stage || !actor) {
      // Fallback para toast
      showDiceToast(`
        <div style="font-family:var(--font-serif); font-size:0.8rem; color:#facc15;">${escapeHtml(title)}</div>
        <div style="font-size:2.2rem; font-weight:900; line-height:1; margin:4px 0;">${total}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(formula)}</div>
        <div style="font-size:0.9rem; font-weight:bold; margin-top:4px; color:${verdictColor}">${escapeHtml(verdict)}</div>
      `);
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (totalEl) totalEl.textContent = total;
    if (formulaEl) formulaEl.textContent = formula;
    if (verdictEl) {
      verdictEl.textContent = verdict;
      verdictEl.style.color = verdictColor;
    }

    // Define o número final a ser estampado no centro da face do dado
    const finalDieNumber = (dieVal !== undefined && dieVal !== null) ? dieVal : total;
    const numStr = String(finalDieNumber);

    if (actorValEl) {
      // Ajusta tamanho da fonte dinamicamente conforme a quantidade de dígitos
      if (numStr.length >= 3) {
        actorValEl.setAttribute('font-size', '15');
      } else if (numStr.length === 2) {
        actorValEl.setAttribute('font-size', '19');
      } else {
        actorValEl.setAttribute('font-size', '22');
      }

      // Efeito de rolagem: gira números aleatórios no dado durante a rotação
      clearInterval(state.diceRollInterval);
      const maxRange = (typeof die === 'number' && die > 1) ? die : 20;
      actorValEl.style.fill = '#ffffff';

      state.diceRollInterval = setInterval(() => {
        const rand = Math.floor(Math.random() * maxRange) + 1;
        actorValEl.textContent = rand;
      }, 40);

      // Ao aterrissar o dado, fixa o resultado exato da rolagem com cor do veredito
      setTimeout(() => {
        clearInterval(state.diceRollInterval);
        actorValEl.textContent = numStr;
        if (verdictColor) {
          actorValEl.style.fill = verdictColor;
        } else {
          actorValEl.style.fill = '#ffffff';
        }
      }, 550);
    }

    clearTimeout(state.cinematicTimer);
    stage.classList.add('active');
    actor.classList.add('rolling');
    if (burst) burst.classList.remove('burst');

    setTimeout(() => {
      actor.classList.remove('rolling');
      if (burst) burst.classList.add('burst');
    }, 600);

    state.cinematicTimer = setTimeout(() => {
      stage.classList.remove('active');
      clearInterval(state.diceRollInterval);
      if (actorValEl) actorValEl.style.fill = '#ffffff';
    }, 2800);
  }

  // Toast flutuante rápido
  function showDiceToast(htmlContent) {
    const toast = document.getElementById('dice-toast');
    const content = document.getElementById('toast-content');
    if (!toast || !content) return;

    content.innerHTML = htmlContent;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Rolagem de Atributo (Total ou Metade)
  function rollAttributeCheck(attrKey, attrDisplayName, isHalf = false) {
    const s = getActiveSheet();
    const rawVal = Number(s.attributes[attrKey] || 0);
    const fixedAttrs = ['carne', 'forca', 'prontidao', 'determinacao', 'mente'];
    const shouldUseHalf = isHalf || fixedAttrs.includes(attrKey);
    const attrValue = shouldUseHalf ? Math.floor(rawVal / 2) : rawVal;
    const naturalD20 = Math.floor(Math.random() * 20) + 1;
    const finalTotal = naturalD20 + attrValue;
    const evalResult = evaluateOblivioRoll(naturalD20, finalTotal, s.zona);

    if (window.soundFX) window.soundFX.playDiceRoll();

    setTimeout(() => {
      if (window.soundFX) {
        if (evalResult.typeClass === 'sucesso-extremo' || evalResult.typeClass === 'sucesso') window.soundFX.playSuccess();
        else if (evalResult.typeClass === 'falha-extrema') window.soundFX.playFailure();
      }
    }, 450);

    const checkTitle = `TESTE DE ${attrDisplayName} (${s.zona.toUpperCase()})`;
    const formulaText = `1d20 [${naturalD20}] ${attrValue >= 0 ? '+' : ''}${attrValue}`;

    triggerCinematicRoll({
      title: checkTitle,
      total: finalTotal,
      formula: formulaText,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass,
      die: 20
    });

    addHistoryEntry({
      title: `Teste de ${attrDisplayName}`,
      total: `${finalTotal}`,
      formula: `${formulaText} = ${finalTotal}`,
      zonaText: `Zona: ${s.zona.toUpperCase()}`,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass
    });
  }

  // Rolagem de Conhecimento
  function rollKnowledgeCheck(name, attrKey, bonusVal) {
    const s = getActiveSheet();
    const attrVal = Number(s.attributes[attrKey] || 0);
    const bonus = Number(bonusVal || 0);
    const naturalD20 = Math.floor(Math.random() * 20) + 1;
    const finalTotal = naturalD20 + attrVal + bonus;
    const evalResult = evaluateOblivioRoll(naturalD20, finalTotal, s.zona);

    if (window.soundFX) window.soundFX.playDiceRoll();

    setTimeout(() => {
      if (window.soundFX) {
        if (evalResult.typeClass === 'sucesso-extremo' || evalResult.typeClass === 'sucesso') window.soundFX.playSuccess();
        else if (evalResult.typeClass === 'falha-extrema') window.soundFX.playFailure();
      }
    }, 450);

    triggerCinematicRoll({
      title: `CONHECIMENTO: ${name}`,
      total: finalTotal,
      formula: `1d20 [${naturalD20}] + ${attrKey.toUpperCase()}(${attrVal}) + Bônus(${bonus})`,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass,
      die: 20
    });

    addHistoryEntry({
      title: `Saber: ${name}`,
      total: `${finalTotal}`,
      formula: `1d20 [${naturalD20}] + ${attrKey.toUpperCase()}(${attrVal}) + Bônus(${bonus}) = ${finalTotal}`,
      zonaText: `Zona: ${s.zona.toUpperCase()}`,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass
    });
  }

  // Rolagem de Local de Impacto Corporal
  function rollBodyHitLocation() {
    const roll = Math.floor(Math.random() * 20) + 1;
    let limbKebab = 'torso';
    let limbName = 'Torso';

    if (roll >= 1 && roll <= 4) {
      limbKebab = 'leg-right';
      limbName = 'Perna Direita';
    } else if (roll >= 5 && roll <= 8) {
      limbKebab = 'leg-left';
      limbName = 'Perna Esquerda';
    } else if (roll >= 9 && roll <= 12) {
      limbKebab = 'torso';
      limbName = 'Torso';
    } else if (roll >= 13 && roll <= 16) {
      limbKebab = 'arm-right';
      limbName = 'Braço Direito';
    } else {
      limbKebab = 'arm-left';
      limbName = 'Braço Esquerdo';
    }

    if (window.soundFX) {
      window.soundFX.playDiceRoll();
      setTimeout(() => window.soundFX.playHit(), 300);
    }

    // Feedback visual no SVG
    document.querySelectorAll('.body-limb').forEach(el => el.classList.remove('critical-hit'));
    const targetLimb = document.getElementById(`svg-limb-${limbKebab}`);
    if (targetLimb) {
      targetLimb.classList.add('critical-hit');
      setTimeout(() => targetLimb.classList.remove('critical-hit'), 2200);
    }

    const feedbackEl = document.getElementById('body-roll-feedback');
    if (feedbackEl) {
      feedbackEl.innerHTML = `<span style="color:#ef4444; font-weight:800;">IMPACTO: [d20: ${roll}] -> ${limbName.toUpperCase()}</span>`;
    }

    triggerCinematicRoll({
      title: 'ROLAGEM DE IMPACTO CORPORAL',
      total: limbName.toUpperCase(),
      formula: `Resultado no d20: [${roll}]`,
      verdict: `Região Atingida: ${limbName}`,
      verdictColor: '#ef4444',
      typeClass: 'sucesso',
      die: 20,
      dieVal: roll
    });

    addHistoryEntry({
      title: 'Impacto Corporal',
      total: limbName,
      formula: `d20 [${roll}] -> ${limbName}`,
      zonaText: 'Impacto Corporal',
      verdict: `Região: ${limbName}`,
      verdictColor: '#ef4444',
      typeClass: 'sucesso'
    });
  }

  // Rolagem de Dano da Arma
  function rollDamageFormula(formulaStr, itemName = 'Arma') {
    if (!formulaStr || formulaStr === '-') return;
    try {
      const clean = formulaStr.toLowerCase().replace(/\s+/g, '');
      const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (!match) return;

      const count = match[1] ? parseInt(match[1], 10) : 1;
      const sides = parseInt(match[2], 10);
      const mod = match[3] ? parseInt(match[3], 10) : 0;

      let rolls = [];
      let sum = 0;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        sum += r;
      }
      const total = sum + mod;

      if (window.soundFX) {
        window.soundFX.playDiceRoll();
        setTimeout(() => window.soundFX.playHit(), 250);
      }

      triggerCinematicRoll({
        title: `DANO: ${itemName}`,
        total: `${total}`,
        formula: `${count}d${sides} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}`,
        verdict: `${total} Pontos de Dano`,
        verdictColor: '#f97316',
        typeClass: 'sucesso',
        die: sides
      });

      addHistoryEntry({
        title: `Dano: ${itemName}`,
        total: `${total}`,
        formula: `${count}d${sides} [${rolls.join('+')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''} = ${total}`,
        zonaText: 'Dano de Combate',
        verdict: `${total} de Dano`,
        verdictColor: '#f97316',
        typeClass: 'sucesso'
      });
    } catch (e) {}
  }

  // Rolagem Livre de Dados
  function executeFreeDiceRoll() {
    const die = state.selectedDiceType || 20;
    const count = parseInt(document.getElementById('dice-count').value, 10) || 1;
    const mod = parseInt(document.getElementById('dice-mod').value, 10) || 0;
    const targetZona = document.getElementById('dice-target-zona').value;

    let rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * die) + 1;
      rolls.push(r);
      sum += r;
    }
    const finalTotal = sum + mod;

    if (window.soundFX) window.soundFX.playDiceRoll();

    let verdictHtml = '';
    let evalObj = null;

    if (die === 20 && targetZona !== 'none') {
      const naturalD20 = rolls[0];
      evalObj = evaluateOblivioRoll(naturalD20, finalTotal, targetZona);
      verdictHtml = `<div class="dice-result-verdict" style="color:${evalObj.color}">${evalObj.verdict}</div>`;
      
      if (window.soundFX) {
        setTimeout(() => {
          if (evalObj.typeClass === 'sucesso-extremo') window.soundFX.playSuccess();
          else if (evalObj.typeClass === 'falha-extrema') window.soundFX.playFailure();
        }, 250);
      }
    }

    const display = document.getElementById('dice-result-display');
    if (display) {
      display.innerHTML = `
        <div class="dice-result-number">${finalTotal}</div>
        <div class="dice-result-breakdown">${count}d${die} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}</div>
        ${verdictHtml}
      `;
    }

    addHistoryEntry({
      title: `Rolagem Livre (${count}d${die})`,
      total: `${finalTotal}`,
      formula: `${count}d${die} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''} = ${finalTotal}`,
      zonaText: targetZona !== 'none' ? `Zona: ${targetZona.toUpperCase()}` : 'Rolagem Livre',
      verdict: evalObj ? evalObj.verdict : `${finalTotal}`,
      verdictColor: evalObj ? evalObj.color : '#ffffff',
      typeClass: evalObj ? evalObj.typeClass : 'normal'
    });
  }

  function executeFormulaRoll(formulaStr) {
    if (!formulaStr) return;
    try {
      const clean = formulaStr.toLowerCase().replace(/\s+/g, '');
      const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (!match) {
        alert('Fórmula inválida! Use formatos como: 1d20+2, 2d6, 3d10-1');
        return;
      }
      const count = match[1] ? parseInt(match[1], 10) : 1;
      const sides = parseInt(match[2], 10);
      const mod = match[3] ? parseInt(match[3], 10) : 0;

      let rolls = [];
      let sum = 0;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        sum += r;
      }
      const finalTotal = sum + mod;

      if (window.soundFX) window.soundFX.playDiceRoll();

      const display = document.getElementById('dice-result-display');
      if (display) {
        display.innerHTML = `
          <div class="dice-result-number">${finalTotal}</div>
          <div class="dice-result-breakdown">${count}d${sides} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}</div>
        `;
      }

      addHistoryEntry({
        title: `Fórmula: ${formulaStr}`,
        total: `${finalTotal}`,
        formula: `${count}d${sides} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''} = ${finalTotal}`,
        zonaText: 'Fórmula Manual',
        verdict: `${finalTotal}`,
        verdictColor: '#ffffff',
        typeClass: 'normal'
      });
    } catch (e) {
      alert('Erro na fórmula.');
    }
  }

  // ==========================================================================
  // CONFIGURAÇÃO DOS EVENT LISTENERS
  // ==========================================================================
  function setupEventListeners() {
    
    // --- Troca e Criação de Fichas ---
    const sheetSelect = document.getElementById('sheet-select');
    if (sheetSelect) {
      sheetSelect.addEventListener('change', e => {
        state.activeSheetId = e.target.value;
        saveSheetsToStorage();
        renderAll();
        if (window.soundFX) window.soundFX.playWhoosh();
      });
    }

    const btnNewSheet = document.getElementById('btn-new-sheet');
    if (btnNewSheet) {
      btnNewSheet.addEventListener('click', () => {
        const name = prompt('Nome da nova persona:', 'Nova persona');
        if (name !== null) {
          const newSheet = createDefaultSheet(name.trim() || 'Nova persona');
          state.sheets.push(newSheet);
          state.activeSheetId = newSheet.id;
          saveSheetsToStorage();
          renderAll();
          if (window.soundFX) window.soundFX.playSuccess();
        }
      });
    }

    const btnCloneSheet = document.getElementById('btn-clone-sheet');
    if (btnCloneSheet) {
      btnCloneSheet.addEventListener('click', () => {
        const current = getActiveSheet();
        const clone = JSON.parse(JSON.stringify(current));
        clone.id = 'sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        clone.name = (clone.name || 'Persona') + ' (Cópia)';
        state.sheets.push(clone);
        state.activeSheetId = clone.id;
        saveSheetsToStorage();
        renderAll();
        if (window.soundFX) window.soundFX.playSuccess();
      });
    }

    const btnDeleteSheet = document.getElementById('btn-delete-sheet');
    if (btnDeleteSheet) {
      btnDeleteSheet.addEventListener('click', () => {
        if (state.sheets.length <= 1) {
          alert('Você deve manter pelo menos uma ficha!');
          return;
        }
        const current = getActiveSheet();
        if (confirm(`Tem certeza que deseja excluir a persona "${current.name}"?`)) {
          state.sheets = state.sheets.filter(s => s.id !== current.id);
          state.activeSheetId = state.sheets[0].id;
          saveSheetsToStorage();
          renderAll();
        }
      });
    }

    // --- Exportar Ficha (Download JSON) ---
    const btnExport = document.getElementById('btn-export-sheet');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const current = getActiveSheet();
        const jsonStr = JSON.stringify(current, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oblivio_${(current.name || 'persona').toLowerCase().replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.soundFX) window.soundFX.playClick();
      });
    }

    // --- Importar Ficha (Upload JSON) ---
    const importFileInput = document.getElementById('import-file');
    if (importFileInput) {
      importFileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
          try {
            const imported = JSON.parse(event.target.result);
            if (!imported.name && !imported.attributes) {
              throw new Error('Arquivo JSON inválido para ficha de Oblívio');
            }
            imported.id = 'sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            state.sheets.push(imported);
            state.activeSheetId = imported.id;
            saveSheetsToStorage();
            renderAll();
            alert(`Ficha "${imported.name}" importada com sucesso!`);
            if (window.soundFX) window.soundFX.playSuccess();
          } catch (err) {
            alert('Erro ao carregar o arquivo JSON. Certifique-se de que é uma ficha válida do Oblívio.');
          }
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }

    // --- Áudio Toggle ---
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        if (window.soundFX) {
          const isMuted = window.soundFX.toggleMute();
          localStorage.setItem(STORAGE_KEY_SOUND, isMuted ? 'true' : 'false');
          updateSoundIcon();
        }
      });
    }

    // --- Avatar Selector Trigger & Modal ---
    const avatarTrigger = document.getElementById('avatar-trigger');
    if (avatarTrigger) {
      avatarTrigger.addEventListener('click', () => {
        const s = getActiveSheet();
        const previewEl = document.getElementById('avatar-modal-preview');
        if (previewEl) previewEl.src = s.avatar || 'assets/default-avatar.svg';
        openModal('modal-avatar');
      });
    }

    // Dropzone de Envio de Arquivo do Computador / Celular
    const avatarDropzone = document.getElementById('avatar-dropzone');
    const avatarFileInput = document.getElementById('avatar-file-input');

    function processAvatarFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const s = getActiveSheet();
        s.avatar = ev.target.result;
        renderPersona();
        const previewEl = document.getElementById('avatar-modal-preview');
        if (previewEl) previewEl.src = s.avatar;
        triggerAutoSave();
        closeModal('modal-avatar');
        if (window.soundFX) window.soundFX.playSuccess();
      };
      reader.readAsDataURL(file);
    }

    if (avatarDropzone && avatarFileInput) {
      avatarDropzone.addEventListener('click', () => {
        avatarFileInput.click();
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        avatarDropzone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          avatarDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        avatarDropzone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          avatarDropzone.classList.remove('dragover');
        });
      });

      avatarDropzone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        if (file) {
          processAvatarFile(file);
        }
      });

      avatarFileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          processAvatarFile(file);
        }
      });
    }

    // Carregar Avatar via Link (URL)
    const btnApplyUrl = document.getElementById('btn-apply-avatar-url');
    const customUrlInput = document.getElementById('custom-avatar-url');
    if (btnApplyUrl && customUrlInput) {
      btnApplyUrl.addEventListener('click', () => {
        const url = customUrlInput.value.trim();
        if (url) {
          const s = getActiveSheet();
          s.avatar = url;
          renderPersona();
          const previewEl = document.getElementById('avatar-modal-preview');
          if (previewEl) previewEl.src = url;
          triggerAutoSave();
          closeModal('modal-avatar');
          customUrlInput.value = '';
          if (window.soundFX) window.soundFX.playSuccess();
        }
      });
    }

    // Remover Avatar / Restaurar Silhueta Padrão
    const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
    if (btnRemoveAvatar) {
      btnRemoveAvatar.addEventListener('click', () => {
        const s = getActiveSheet();
        s.avatar = 'assets/default-avatar.svg';
        renderPersona();
        const previewEl = document.getElementById('avatar-modal-preview');
        if (previewEl) previewEl.src = 'assets/default-avatar.svg';
        triggerAutoSave();
        closeModal('modal-avatar');
        if (window.soundFX) window.soundFX.playClick();
      });
    }

    // --- Persona Form Inputs ---
    const personaInputs = ['persona-name', 'persona-motivation', 'persona-player'];
    personaInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', e => {
          const s = getActiveSheet();
          if (id === 'persona-name') {
            s.name = e.target.value;
            renderSheetSelector();
          } else if (id === 'persona-motivation') {
            s.motivation = e.target.value;
          } else if (id === 'persona-player') {
            s.player = e.target.value;
          }
          triggerAutoSave();
        });
      }
    });

    const roleSelect = document.getElementById('persona-role');
    if (roleSelect) {
      roleSelect.addEventListener('change', e => {
        const s = getActiveSheet();
        if (e.target.value === 'custom') {
          const custom = prompt('Digite o Papel personalizado:', s.role || 'Quem Age');
          if (custom) {
            s.role = custom.trim();
          }
        } else {
          s.role = e.target.value;
        }
        renderPersona();
        triggerAutoSave();
      });
    }

    const btnEditRole = document.getElementById('btn-edit-role-custom');
    if (btnEditRole) {
      btnEditRole.addEventListener('click', () => {
        const s = getActiveSheet();
        const custom = prompt('Editar Papel da Persona:', s.role || '');
        if (custom !== null) {
          s.role = custom.trim();
          renderPersona();
          triggerAutoSave();
        }
      });
    }

    // --- Steppers de PA e Evoluções ---
    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const op = btn.dataset.op;
        const input = document.getElementById(targetId);
        if (!input) return;

        let val = parseInt(input.value, 10) || 0;
        if (op === 'inc') val++;
        else if (op === 'dec' && val > 0) val--;

        input.value = val;
        const s = getActiveSheet();
        if (targetId === 'persona-ap') s.ap = val;
        if (targetId === 'persona-ev') s.ev = val;
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    ['persona-ap', 'persona-ev'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', e => {
          const s = getActiveSheet();
          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
          if (id === 'persona-ap') s.ap = val;
          if (id === 'persona-ev') s.ev = val;
          triggerAutoSave();
        });
      }
    });

    // --- Habilidade Inicial Expand/Collapse & Edit ---
    const btnToggleInitDesc = document.getElementById('btn-toggle-initial-desc');
    const initDesc = document.getElementById('initial-ability-desc');
    if (btnToggleInitDesc && initDesc) {
      btnToggleInitDesc.addEventListener('click', () => {
        initDesc.classList.toggle('collapsed');
        btnToggleInitDesc.textContent = initDesc.classList.contains('collapsed') ? '▶' : '▼';
      });
    }

    const btnEditInitialAbility = document.getElementById('btn-edit-initial-ability');
    if (btnEditInitialAbility) {
      btnEditInitialAbility.addEventListener('click', () => {
        const s = getActiveSheet();
        const init = s.initialAbility || { name: '', type: '(EFEITO PASSIVO)', desc: '' };
        const newName = prompt('Nome da Habilidade Inicial (deixe vazio para remover):', init.name || '');
        if (newName === null) return;
        if (!newName.trim()) {
          s.initialAbility = null;
          renderAbilities();
          triggerAutoSave();
          return;
        }
        const newType = prompt('Tipo (ex: (EFEITO PASSIVO), AÇÃO):', init.type || '(EFEITO PASSIVO)');
        if (newType === null) return;
        const newDesc = prompt('Descrição dos efeitos:', init.desc || '');
        if (newDesc === null) return;

        s.initialAbility = {
          name: newName.trim(),
          type: newType.trim() || '(EFEITO)',
          desc: newDesc.trim()
        };
        renderAbilities();
        triggerAutoSave();
      });
    }

    const btnDeleteInitialAbility = document.getElementById('btn-delete-initial-ability');
    if (btnDeleteInitialAbility) {
      btnDeleteInitialAbility.addEventListener('click', e => {
        e.stopPropagation();
        const s = getActiveSheet();
        s.initialAbility = null;
        renderAbilities();
        triggerAutoSave();
      });
    }

    // --- Habilidades: Adicionar / Editar / Excluir ---
    const btnAddAbility = document.getElementById('btn-add-ability');
    if (btnAddAbility) {
      btnAddAbility.addEventListener('click', () => {
        openModal('modal-ability');
        document.getElementById('ability-modal-title').textContent = 'ADICIONAR HABILIDADE';
        document.getElementById('form-ability').reset();
        document.getElementById('ability-id').value = '';
      });
    }

    const formAbility = document.getElementById('form-ability');
    if (formAbility) {
      formAbility.addEventListener('submit', e => {
        e.preventDefault();
        const s = getActiveSheet();
        const id = document.getElementById('ability-id').value;
        const name = document.getElementById('ability-name-input').value.trim();
        const type = document.getElementById('ability-type-input').value.trim();
        const cost = document.getElementById('ability-cost-input').value.trim();
        const desc = document.getElementById('ability-desc-input').value.trim();

        if (id) {
          const target = s.abilities.find(a => a.id === id);
          if (target) {
            target.name = name;
            target.type = type;
            target.cost = cost;
            target.desc = desc;
          }
        } else {
          s.abilities.push({
            id: 'ab_' + Date.now(),
            name,
            type,
            cost,
            desc
          });
        }
        closeModal('modal-ability');
        renderAbilities();
        triggerAutoSave();
      });
    }

    const abilitiesList = document.getElementById('abilities-list');
    if (abilitiesList) {
      abilitiesList.addEventListener('click', e => {
        const s = getActiveSheet();
        const editBtn = e.target.closest('.btn-sm-action.edit');
        const delBtn = e.target.closest('.btn-sm-action.delete');

        if (editBtn) {
          const id = editBtn.dataset.id;
          const target = s.abilities.find(a => a.id === id);
          if (target) {
            openModal('modal-ability');
            document.getElementById('ability-modal-title').textContent = 'EDITAR HABILIDADE';
            document.getElementById('ability-id').value = target.id;
            document.getElementById('ability-name-input').value = target.name;
            document.getElementById('ability-type-input').value = target.type || '';
            document.getElementById('ability-cost-input').value = target.cost || '';
            document.getElementById('ability-desc-input').value = target.desc || '';
          }
        } else if (delBtn) {
          const id = delBtn.dataset.id;
          if (confirm('Remover esta habilidade?')) {
            s.abilities = s.abilities.filter(a => a.id !== id);
            renderAbilities();
            triggerAutoSave();
          }
        }
      });
    }

    // --- Estresse & Silhueta Corporal ---
    // Steppers de Estresse
    document.querySelectorAll('.btn-limb-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const limb = btn.dataset.limb;
        const op = btn.dataset.op;
        const s = getActiveSheet();
        if (!s.stress[limb]) s.stress[limb] = { cur: 0, max: 0, checked: false };

        if (op === 'inc') {
          s.stress[limb].cur++;
        } else if (op === 'dec' && s.stress[limb].cur > 0) {
          s.stress[limb].cur--;
        }

        renderStress();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    // Stepper para Estresse Máximo (- / +)
    document.querySelectorAll('.btn-limb-max-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const limb = btn.dataset.limb;
        const op = btn.dataset.op;
        const s = getActiveSheet();
        if (!s.stress[limb]) s.stress[limb] = { cur: 0, max: 0, checked: false };

        if (op === 'inc') {
          s.stress[limb].max++;
        } else if (op === 'dec' && s.stress[limb].max > 0) {
          s.stress[limb].max--;
        }

        renderStress();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    // Edição do Estresse Máximo ao clicar no valor máximo
    const limbs = ['armRight', 'armLeft', 'torso', 'legRight', 'legLeft'];
    limbs.forEach(limb => {
      const maxSpan = document.getElementById(`val-${limb}-max`);
      if (maxSpan) {
        maxSpan.addEventListener('click', () => {
          const s = getActiveSheet();
          const currentMax = s.stress[limb]?.max || 0;
          const input = prompt(`Estresse Máximo para ${limb}:`, currentMax);
          if (input !== null) {
            const val = Math.max(0, parseInt(input, 10) || 0);
            s.stress[limb].max = val;
            renderStress();
            triggerAutoSave();
          }
        });
      }
    });

    // Checkboxes dos Membros (Lesão / Crítico)
    document.querySelectorAll('.limb-injury-chk, .limb-check-title input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        const s = getActiveSheet();
        const limbKebab = chk.id.replace('check-', '');
        let limbKey = 'torso';
        if (limbKebab === 'arm-right') limbKey = 'armRight';
        else if (limbKebab === 'arm-left') limbKey = 'armLeft';
        else if (limbKebab === 'leg-right') limbKey = 'legRight';
        else if (limbKebab === 'leg-left') limbKey = 'legLeft';

        if (!s.stress[limbKey]) s.stress[limbKey] = { cur: 0, max: 0, checked: false };
        s.stress[limbKey].checked = chk.checked;

        updateSilhouetteLimbState(limbKebab, s.stress[limbKey]);
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    // Hover e Clique Interativo sobre partes da Silhueta SVG
    document.querySelectorAll('.body-limb').forEach(limbGroup => {
      const limbKebab = limbGroup.dataset.limb;
      limbGroup.addEventListener('mouseenter', () => {
        const box = document.querySelector(`.limb-box[data-limb="${limbKebab}"]`);
        if (box) box.style.borderColor = 'var(--accent-gold)';
      });
      limbGroup.addEventListener('mouseleave', () => {
        const box = document.querySelector(`.limb-box[data-limb="${limbKebab}"]`);
        if (box) box.style.borderColor = '';
      });
      limbGroup.addEventListener('click', () => {
        // Incrementa estresse do membro clicado
        let limbKey = 'torso';
        if (limbKebab === 'arm-right') limbKey = 'armRight';
        else if (limbKebab === 'arm-left') limbKey = 'armLeft';
        else if (limbKebab === 'leg-right') limbKey = 'legRight';
        else if (limbKebab === 'leg-left') limbKey = 'legLeft';

        const s = getActiveSheet();
        if (!s.stress[limbKey]) s.stress[limbKey] = { cur: 0, max: 0, checked: false };
        s.stress[limbKey].cur++;
        renderStress();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playHit();
      });
    });

    // Hover sobre caixas de membros destaca o SVG correspondente
    document.querySelectorAll('.limb-box').forEach(box => {
      box.addEventListener('mouseenter', () => {
        const limb = box.dataset.limb;
        document.querySelectorAll(`.body-limb[data-limb="${limb}"]`).forEach(el => el.classList.add('highlight'));
      });
      box.addEventListener('mouseleave', () => {
        const limb = box.dataset.limb;
        document.querySelectorAll(`.body-limb[data-limb="${limb}"]`).forEach(el => el.classList.remove('highlight'));
      });
    });

    // Botão Rolar Corpo
    const btnRollBody = document.getElementById('btn-roll-body');
    if (btnRollBody) {
      btnRollBody.addEventListener('click', rollBodyHitLocation);
    }

    // --- Atributos: Steppers e Rolagens ---
    document.querySelectorAll('.btn-attr-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const op = btn.dataset.op;
        const s = getActiveSheet();
        let val = Number(s.attributes[attr] || 0);

        if (op === 'inc') val++;
        else if (op === 'dec' && val > 0) val--;

        s.attributes[attr] = val;
        renderAttributes();
        if (attr === 'carne' || attr === 'forca') {
          renderInventory();
        }
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    document.querySelectorAll('.btn-attr-roll').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const name = btn.dataset.name || attr.toUpperCase();
        const fixedAttrs = ['carne', 'forca', 'prontidao', 'determinacao', 'mente'];
        const isFixed = fixedAttrs.includes(attr);
        rollAttributeCheck(attr, name, isFixed);
      });
    });

    document.querySelectorAll('.btn-attr-half-roll').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const name = btn.dataset.name || attr.toUpperCase();
        rollAttributeCheck(attr, name, true);
      });
    });

    // --- Zona de Acerto Pills ---
    document.querySelectorAll('.btn-zona').forEach(btn => {
      btn.addEventListener('click', () => {
        const zona = btn.dataset.zona;
        const s = getActiveSheet();
        s.zona = zona;
        renderZonaAcerto();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    // --- Tabs (Inventário, Conhecimentos, Mazelas, Notas) ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const activePane = document.getElementById(`tab-${targetTab}`);
        if (activePane) activePane.classList.add('active');
        if (window.soundFX) window.soundFX.playWhoosh();
      });
    });

    // --- Inventário: Itens Adicionar/Editar/Excluir/Usar ---
    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        openModal('modal-item');
        document.getElementById('item-modal-title').textContent = 'ADICIONAR ITEM';
        document.getElementById('form-item').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('item-category').value = 'carregado';
        const burdenInput = document.getElementById('item-burden');
        if (burdenInput) burdenInput.value = '1';
      });
    }

    const formItem = document.getElementById('form-item');
    if (formItem) {
      formItem.addEventListener('submit', e => {
        e.preventDefault();
        const s = getActiveSheet();
        const id = document.getElementById('item-id').value.trim();
        const cat = document.getElementById('item-category').value;
        const name = document.getElementById('item-name').value.trim();
        const type = document.getElementById('item-type').value.trim();
        const damage = document.getElementById('item-damage').value.trim();
        const stress = document.getElementById('item-stress').value.trim();
        const burdenInput = document.getElementById('item-burden').value;
        const burden = Math.max(0, parseInt(burdenInput, 10) || 0);
        const uses = document.getElementById('item-uses').value.trim();
        const desc = document.getElementById('item-desc').value.trim();

        if (!name) return;

        if (!s.inventory) {
          s.inventory = { carregados: [], guardados: [] };
        }
        if (!Array.isArray(s.inventory.carregados)) s.inventory.carregados = [];
        if (!Array.isArray(s.inventory.guardados)) s.inventory.guardados = [];

        // Se for edição, remove de onde quer que esteja para reinserir com os dados atualizados
        if (id) {
          s.inventory.carregados = s.inventory.carregados.filter(i => String(i.id).trim() !== id);
          s.inventory.guardados = s.inventory.guardados.filter(i => String(i.id).trim() !== id);
        }

        const finalItem = {
          id: id || ('inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
          name,
          category: cat,
          type: type || (cat === 'carregado' ? 'Arma' : 'Geral'),
          damage,
          stress,
          burden,
          uses,
          desc
        };

        if (cat === 'carregado') {
          s.inventory.carregados.push(finalItem);
        } else {
          s.inventory.guardados.push(finalItem);
        }

        closeModal('modal-item');
        renderInventory();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playSuccess();
      });
    }

    // Ações de itens na tabela (Usar, Dano, Editar, Deletar)
    document.addEventListener('click', e => {
      const s = getActiveSheet();

      // Botão USAR item
      const useBtn = e.target.closest('.btn-use-item');
      if (useBtn) {
        const id = String(useBtn.dataset.id).trim();
        const item = (s.inventory?.carregados || []).find(i => String(i.id).trim() === id) ||
                     (s.inventory?.guardados || []).find(i => String(i.id).trim() === id);
        if (item) {
          if (item.damage && item.damage !== '-') {
            rollDamageFormula(item.damage, item.name);
          } else {
            if (window.soundFX) window.soundFX.playClick();
            showDiceToast(`
              <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold);">USO DE ITEM</div>
              <div style="font-size:1.4rem; font-weight:700; margin:4px 0;">${escapeHtml(item.name)}</div>
              <div style="font-size:0.75rem; color:#cbd5e1;">${escapeHtml(item.desc || 'Item utilizado com sucesso.')}</div>
            `);
          }
        }
      }

      // Botão Rolar Dano
      const dmgBtn = e.target.closest('.btn-roll-dmg');
      if (dmgBtn) {
        const formula = dmgBtn.dataset.dmg;
        const name = dmgBtn.dataset.name;
        rollDamageFormula(formula, name);
      }

      // Botão Editar Item
      const editItemBtn = e.target.closest('.edit-item');
      if (editItemBtn) {
        const id = String(editItemBtn.dataset.id).trim();
        let item = null;
        let itemCat = 'carregado';

        if (Array.isArray(s.inventory?.carregados)) {
          item = s.inventory.carregados.find(i => String(i.id).trim() === id);
          if (item) itemCat = 'carregado';
        }
        if (!item && Array.isArray(s.inventory?.guardados)) {
          item = s.inventory.guardados.find(i => String(i.id).trim() === id);
          if (item) itemCat = 'guardado';
        }

        if (item) {
          openModal('modal-item');
          document.getElementById('item-modal-title').textContent = 'EDITAR ITEM';
          document.getElementById('item-id').value = item.id;
          document.getElementById('item-category').value = itemCat;
          document.getElementById('item-name').value = item.name || '';
          document.getElementById('item-type').value = item.type || '';
          document.getElementById('item-damage').value = item.damage || '';
          document.getElementById('item-stress').value = item.stress || '';
          document.getElementById('item-burden').value = item.burden !== undefined ? item.burden : 1;
          document.getElementById('item-uses').value = item.uses || '';
          document.getElementById('item-desc').value = item.desc || '';
        }
      }

      // Botão Deletar Item
      const delItemBtn = e.target.closest('.delete-item');
      if (delItemBtn) {
        const id = String(delItemBtn.dataset.id).trim();
        if (confirm('Remover este item?')) {
          if (Array.isArray(s.inventory?.carregados)) {
            s.inventory.carregados = s.inventory.carregados.filter(i => String(i.id).trim() !== id);
          }
          if (Array.isArray(s.inventory?.guardados)) {
            s.inventory.guardados = s.inventory.guardados.filter(i => String(i.id).trim() !== id);
          }
          renderInventory();
          triggerAutoSave();
        }
      }

      // Conhecimento: Testar ou Deletar
      const knRollBtn = e.target.closest('.btn-roll-knowledge');
      if (knRollBtn) {
        const attr = knRollBtn.dataset.attr;
        const bonus = knRollBtn.dataset.bonus;
        const name = knRollBtn.dataset.name;
        rollKnowledgeCheck(name, attr, bonus);
      }

      const delKnBtn = e.target.closest('.delete-knowledge');
      if (delKnBtn) {
        const id = delKnBtn.dataset.id;
        if (confirm('Remover este conhecimento?')) {
          s.knowledge = s.knowledge.filter(k => k.id !== id);
          renderKnowledge();
          triggerAutoSave();
        }
      }

      // Mazela: Deletar
      const delMzBtn = e.target.closest('.delete-mazela');
      if (delMzBtn) {
        const id = delMzBtn.dataset.id;
        if (confirm('Remover esta mazela?')) {
          s.mazelas = s.mazelas.filter(m => m.id !== id);
          renderMazelas();
          triggerAutoSave();
        }
      }
    });

    // --- Conhecimento: Adicionar Form ---
    const btnAddKnowledge = document.getElementById('btn-add-knowledge');
    if (btnAddKnowledge) {
      btnAddKnowledge.addEventListener('click', () => {
        openModal('modal-knowledge');
        document.getElementById('form-knowledge').reset();
        document.getElementById('knowledge-id').value = '';
      });
    }

    const formKnowledge = document.getElementById('form-knowledge');
    if (formKnowledge) {
      formKnowledge.addEventListener('submit', e => {
        e.preventDefault();
        const s = getActiveSheet();
        const name = document.getElementById('knowledge-name-input').value.trim();
        const attr = document.getElementById('knowledge-attr-input').value;
        const bonus = parseInt(document.getElementById('knowledge-bonus-input').value, 10) || 0;
        const desc = document.getElementById('knowledge-desc-input').value.trim();

        s.knowledge.push({
          id: 'kn_' + Date.now(),
          name,
          attr,
          bonus,
          desc
        });

        closeModal('modal-knowledge');
        renderKnowledge();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playSuccess();
      });
    }

    // --- Mazela: Adicionar Form ---
    const btnAddMazela = document.getElementById('btn-add-mazela');
    if (btnAddMazela) {
      btnAddMazela.addEventListener('click', () => {
        openModal('modal-mazela');
        document.getElementById('form-mazela').reset();
        document.getElementById('mazela-id').value = '';
      });
    }

    const formMazela = document.getElementById('form-mazela');
    if (formMazela) {
      formMazela.addEventListener('submit', e => {
        e.preventDefault();
        const s = getActiveSheet();
        const name = document.getElementById('mazela-name-input').value.trim();
        const severity = document.getElementById('mazela-severity-input').value;
        const type = document.getElementById('mazela-type-input').value;
        const desc = document.getElementById('mazela-desc-input').value.trim();

        s.mazelas.push({
          id: 'mz_' + Date.now(),
          name,
          severity,
          type,
          desc
        });

        closeModal('modal-mazela');
        renderMazelas();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playFailure();
      });
    }

    // --- Notas: Auto-Save ao Digitar ---
    const notesEl = document.getElementById('persona-notes');
    if (notesEl) {
      notesEl.addEventListener('input', e => {
        const s = getActiveSheet();
        s.notes = e.target.value;
        triggerAutoSave();
      });
    }

    // --- Modal Rolagem Livre & Histórico ---
    const btnOpenDice = document.getElementById('btn-open-dice-roller');
    if (btnOpenDice) {
      btnOpenDice.addEventListener('click', () => {
        openModal('modal-dice');
      });
    }

    const btnOpenHistory = document.getElementById('btn-open-history');
    if (btnOpenHistory) {
      btnOpenHistory.addEventListener('click', () => {
        renderHistoryModal();
        openModal('modal-history');
      });
    }

    // Seleção de tipo de dado no modal
    document.querySelectorAll('.btn-dice-select').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-dice-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedDiceType = parseInt(btn.dataset.die, 10);
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    const btnExecDiceRoll = document.getElementById('btn-execute-dice-roll');
    if (btnExecDiceRoll) {
      btnExecDiceRoll.addEventListener('click', executeFreeDiceRoll);
    }

    const btnRollFormula = document.getElementById('btn-roll-formula');
    const formulaInput = document.getElementById('dice-formula-input');
    if (btnRollFormula && formulaInput) {
      btnRollFormula.addEventListener('click', () => {
        executeFormulaRoll(formulaInput.value.trim());
      });
      formulaInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeFormulaRoll(formulaInput.value.trim());
        }
      });
    }

    // Limpar / Copiar Histórico
    const btnClearHist = document.getElementById('btn-clear-history');
    if (btnClearHist) {
      btnClearHist.addEventListener('click', () => {
        if (confirm('Deseja limpar todo o histórico de rolagens?')) {
          state.history = [];
          saveRollHistory();
          renderHistoryModal();
        }
      });
    }

    const btnCopyHist = document.getElementById('btn-copy-history');
    if (btnCopyHist) {
      btnCopyHist.addEventListener('click', () => {
        if (state.history.length === 0) return;
        const text = state.history.map(h => `[${h.timestamp}] ${h.personaName}: ${h.title} -> ${h.total} (${h.verdict || ''})`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
          alert('Histórico copiado para a área de transferência!');
        });
      });
    }

    // Fechar Cinematic Stage ao clicar
    const cinematicStage = document.getElementById('cinematic-dice-stage');
    if (cinematicStage) {
      cinematicStage.addEventListener('click', () => {
        cinematicStage.classList.remove('active');
        clearTimeout(state.cinematicTimer);
        clearInterval(state.diceRollInterval);
      });
    }

    // Fechar modais
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        if (cinematicStage) {
          cinematicStage.classList.remove('active');
          clearTimeout(state.cinematicTimer);
          clearInterval(state.diceRollInterval);
        }
      }
    });
  }

  // --- Funções Auxiliares de Modal ---
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (window.soundFX) window.soundFX.playClick();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
