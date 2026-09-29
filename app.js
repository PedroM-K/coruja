/**
 * OBLÍVIO RPG - Ficha de Persona Interativa
 * Gerenciador de Fichas Local (localStorage / Cache sem necessidade de banco de dados)
 * Sistema de regras, rolagens com Zona de Acerto, rastreamento corporal de estresse e inventário.
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
      avatar: 'assets/avatar-sigil.svg',
      ap: 5,
      ev: 0,
      initialAbility: {
        name: 'Voracidade',
        type: '(EFEITO PASSIVO)',
        desc: 'Sempre que devorar os restos mortais de uma vítima ou carne recém-abatida, restaure 1 de Estresse em uma região corporal à sua escolha.'
      },
      abilities: [
        {
          id: 'ab_1',
          name: 'Golpe Voraz',
          type: 'AÇÃO DE COMBATE',
          cost: '1 PA',
          desc: ' desfere um ataque visceral. Se acertar, causa dano normal e aplica 1 de Estresse adicional no membro do alvo.'
        }
      ],
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
        folego: 0,
        dano: 0,
        coragem: 0,
        protecao: 0,
        velocidade: 0
      },
      zona: 'normal', // 'reduzida' | 'normal' | 'aumentada'
      inventory: {
        carregados: [
          {
            id: 'inv_1',
            name: 'Lâmina Serrilhada',
            damage: '1d6+1',
            stress: '0',
            desc: 'Faca improvisada de metal oxidado.'
          },
          {
            id: 'inv_2',
            name: 'Revólver Gasto',
            damage: '1d10',
            stress: '+1',
            desc: 'Tambor de 6 tiros. Ruidoso e letal.'
          }
        ],
        guardados: [
          {
            id: 'inv_3',
            type: 'Utilitário',
            name: 'Atadura Imunda',
            burden: 1,
            uses: '2/2',
            desc: 'Estanca sangramentos leves.'
          },
          {
            id: 'inv_4',
            type: 'Oculto',
            name: 'Giz de Osso',
            burden: 1,
            uses: '5/5',
            desc: 'Usado para desenhar círculos de proteção.'
          }
        ],
        slotsUsed: [true, true, false, false, false]
      },
      knowledge: [
        {
          id: 'kn_1',
          name: 'Sobrevivência Urbana',
          attr: 'prontidao',
          bonus: 1,
          desc: 'Navegação por escombros e esconderijos.'
        },
        {
          id: 'kn_2',
          name: 'Ocultismo Proibido',
          attr: 'mente',
          bonus: 2,
          desc: 'Identificação de símbolos e entidades do Oblívio.'
        }
      ],
      mazelas: [
        {
          id: 'mz_1',
          name: 'Pesadelos Recorrentes',
          severity: 'Leve',
          type: 'Mental',
          desc: 'Ao acordar de um descanso curto, faça um teste de Determinação para não acordar em pânico.'
        }
      ],
      notes: ''
    };
  }

  // --- Estado Global da Aplicação ---
  const state = {
    sheets: [],
    activeSheetId: null,
    history: [],
    selectedDiceType: 20,
    saveDebounceTimer: null
  };

  // --- Inicialização e Carregamento do Cache Local ---
  function initApp() {
    loadSoundPref();
    loadRollHistory();
    loadSheetsFromStorage();
    setupEventListeners();
    renderAll();
  }

  function loadSoundPref() {
    const saved = localStorage.getItem(STORAGE_KEY_SOUND);
    if (saved !== null && window.soundFX) {
      window.soundFX.muted = (saved === 'true');
      updateSoundIcon();
    }
  }

  function updateSoundIcon() {
    const icon = document.getElementById('sound-icon');
    if (icon && window.soundFX) {
      icon.textContent = window.soundFX.muted ? '🔇' : '🔊';
    }
  }

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
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  function triggerAutoSave() {
    if (state.saveDebounceTimer) {
      clearTimeout(state.saveDebounceTimer);
    }
    state.saveDebounceTimer = setTimeout(() => {
      saveSheetsToStorage();
    }, 350);
  }

  function showSaveIndicator() {
    const statusText = document.getElementById('status-text');
    const syncStatus = document.getElementById('sync-status');
    if (!statusText || !syncStatus) return;

    statusText.textContent = 'Salvo no cache ✓';
    syncStatus.style.borderColor = 'rgba(34, 197, 94, 0.6)';
    setTimeout(() => {
      statusText.textContent = 'Salvo localmente';
      syncStatus.style.borderColor = 'rgba(34, 197, 94, 0.25)';
    }, 1800);
  }

  function getActiveSheet() {
    return state.sheets.find(s => s.id === state.activeSheetId) || state.sheets[0];
  }

  // --- Renderização Completa da Interface ---
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

  // --- Render: Persona ---
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
    if (avatarEl && s.avatar) avatarEl.src = s.avatar;

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
        // Papel personalizado
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
    if (apEl) apEl.value = s.ap ?? 5;
    if (evEl) evEl.value = s.ev ?? 0;
  }

  // --- Render: Habilidades ---
  function renderAbilities() {
    const s = getActiveSheet();

    // Habilidade Inicial
    const initName = document.getElementById('initial-ability-name');
    const initType = document.getElementById('initial-ability-type');
    const initDesc = document.getElementById('initial-ability-desc');
    if (s.initialAbility) {
      if (initName) initName.textContent = s.initialAbility.name;
      if (initType) initType.textContent = s.initialAbility.type;
      if (initDesc) initDesc.textContent = s.initialAbility.desc;
    }

    // Lista de Habilidades Únicas e Gerais
    const listEl = document.getElementById('abilities-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!s.abilities || s.abilities.length === 0) {
      listEl.innerHTML = '<div style="color:#666; font-size:0.75rem; text-align:center; padding:8px;">Nenhuma habilidade adicionada ainda. Clique em + para criar.</div>';
      return;
    }

    s.abilities.forEach(ab => {
      const item = document.createElement('div');
      item.className = 'ability-item';
      item.innerHTML = `
        <div class="ability-header">
          <div>
            <span class="ability-name">${escapeHtml(ab.name)}</span>
            <span class="ability-type" style="margin-left:4px;">${escapeHtml(ab.type || '')} ${ab.cost ? '• ' + escapeHtml(ab.cost) : ''}</span>
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
      if (curEl) curEl.textContent = data.cur;
      if (maxEl) maxEl.textContent = data.max;

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
    const svgLimb = document.getElementById(`svg-limb-${kebabLimb}`);
    if (!svgLimb) return;

    if (data.checked || (data.max > 0 && data.cur >= data.max)) {
      svgLimb.classList.add('damaged');
    } else {
      svgLimb.classList.remove('damaged');
    }
  }

  // --- Render: Atributos & Aspectos ---
  function renderAttributes() {
    const s = getActiveSheet();
    const attrs = ['carne', 'forca', 'prontidao', 'determinacao', 'mente', 'folego', 'dano', 'coragem', 'protecao', 'velocidade'];

    attrs.forEach(attr => {
      const valEl = document.getElementById(`val-attr-${attr}`);
      if (valEl) {
        valEl.textContent = s.attributes[attr] ?? 0;
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

    const diceZonaSelect = document.getElementById('dice-target-zona');
    if (diceZonaSelect) {
      diceZonaSelect.value = zona;
    }
  }

  // --- Render: Inventário ---
  function renderInventory() {
    const s = getActiveSheet();

    // Carregados
    const tbodyCarregados = document.getElementById('tbody-carregados');
    if (tbodyCarregados) {
      tbodyCarregados.innerHTML = '';
      if (!s.inventory.carregados || s.inventory.carregados.length === 0) {
        tbodyCarregados.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666; padding:8px;">Nenhum item carregado.</td></tr>`;
      } else {
        s.inventory.carregados.forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><button class="btn-use-item" data-id="${item.id}" title="Usar item">USAR</button></td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>
              ${item.damage ? `<button class="btn-roll-dmg" data-dmg="${escapeHtml(item.damage)}" data-name="${escapeHtml(item.name)}" title="Rolar dano">${escapeHtml(item.damage)}</button>` : '-'}
            </td>
            <td>${escapeHtml(item.stress || '0')}</td>
            <td>
              <button class="btn-sm-action edit-item" data-id="${item.id}" data-cat="carregado" title="Editar">✎</button>
              <button class="btn-sm-action delete-item" data-id="${item.id}" data-cat="carregado" title="Remover">✕</button>
            </td>
          `;
          tbodyCarregados.appendChild(tr);
        });
      }
    }

    // Slots Guardados
    const slotsBoxes = document.getElementById('slots-boxes');
    if (slotsBoxes) {
      slotsBoxes.innerHTML = '';
      const slots = s.inventory.slotsUsed || [false, false, false, false, false];
      slots.forEach((used, idx) => {
        const box = document.createElement('div');
        box.className = 'slot-box' + (used ? ' used' : '');
        box.dataset.index = idx;
        box.title = `Espaço ${idx + 1}: ${used ? 'Ocupado' : 'Livre'}`;
        slotsBoxes.appendChild(box);
      });
    }

    // Guardados
    const tbodyGuardados = document.getElementById('tbody-guardados');
    if (tbodyGuardados) {
      tbodyGuardados.innerHTML = '';
      if (!s.inventory.guardados || s.inventory.guardados.length === 0) {
        tbodyGuardados.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666; padding:8px;">Nenhum item guardado.</td></tr>`;
      } else {
        s.inventory.guardados.forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><span class="badge-tag" style="background:#222; color:#ccc;">${escapeHtml(item.type || 'Geral')}</span></td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(String(item.burden || 1))}</td>
            <td>${escapeHtml(item.uses || '-')}</td>
            <td>
              <button class="btn-sm-action edit-item" data-id="${item.id}" data-cat="guardado" title="Editar">✎</button>
              <button class="btn-sm-action delete-item" data-id="${item.id}" data-cat="guardado" title="Remover">✕</button>
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
      listEl.innerHTML = '<div style="color:#666; font-size:0.75rem; text-align:center; padding:8px;">Nenhum conhecimento registrado. Clique em + para adicionar.</div>';
      return;
    }

    s.knowledge.forEach(kn => {
      const item = document.createElement('div');
      item.className = 'knowledge-item';
      item.innerHTML = `
        <div class="knowledge-header">
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-attr-roll btn-roll-knowledge" data-attr="${kn.attr}" data-bonus="${kn.bonus || 0}" data-name="${escapeHtml(kn.name)}" title="Testar Conhecimento">
              🎲 <strong>${escapeHtml(kn.name)}</strong>
            </button>
            <span class="badge-tag badge-${kn.attr}">${(kn.attr || '').toUpperCase()} +${kn.bonus || 0}</span>
          </div>
          <div class="ability-actions">
            <button class="btn-sm-action delete-knowledge" data-id="${kn.id}" title="Remover">✕</button>
          </div>
        </div>
        ${kn.desc ? `<div class="ability-body" style="border:none; padding:0;">${escapeHtml(kn.desc)}</div>` : ''}
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
      listEl.innerHTML = '<div style="color:#666; font-size:0.75rem; text-align:center; padding:8px;">Nenhuma mazela ou trauma registrado. A mente e corpo ainda resistem.</div>';
      return;
    }

    s.mazelas.forEach(mz => {
      const item = document.createElement('div');
      item.className = 'mazela-item';
      item.innerHTML = `
        <div class="mazela-header">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="mazela-name">${escapeHtml(mz.name)}</span>
            <span class="badge-tag badge-severity-${mz.severity}">${escapeHtml(mz.severity)}</span>
            <span class="badge-tag" style="background:#222; color:#bbb;">${escapeHtml(mz.type || 'Geral')}</span>
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

  // --- Render: Histórico Modal ---
  function renderHistoryModal() {
    const listEl = document.getElementById('history-log-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.history.length === 0) {
      listEl.innerHTML = '<div style="color:#666; font-size:0.8rem; text-align:center; padding:16px;">Nenhuma rolagem feita ainda.</div>';
      return;
    }

    state.history.forEach(log => {
      const item = document.createElement('div');
      item.className = `history-log-item hist-${log.typeClass || 'normal'}`;
      item.innerHTML = `
        <div class="history-meta-row">
          <span>${log.timestamp} • ${escapeHtml(log.personaName)}</span>
          <span>${escapeHtml(log.zonaText || '')}</span>
        </div>
        <div class="history-main-row">
          <span class="history-title">${escapeHtml(log.title)}</span>
          <span class="history-total">${escapeHtml(log.total)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#aaa;">
          <span>${escapeHtml(log.formula)}</span>
          <strong style="${log.verdictColor ? 'color:' + log.verdictColor : ''}">${escapeHtml(log.verdict || '')}</strong>
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  // --- Sistema de Regras: Testes com d20 e Zona de Acerto ---
  function evaluateOblivioRoll(naturalD20, finalTotal, zona) {
    // Regra oficial Oblívio:
    // Natural 1 = Falha Extrema
    // Natural 20 = Sucesso Extremo
    if (naturalD20 === 1) {
      return {
        verdict: '💀 FALHA EXTREMA',
        color: '#ff1744',
        typeClass: 'falha-extrema'
      };
    }
    if (naturalD20 === 20) {
      return {
        verdict: '🌟 SUCESSO EXTREMO',
        color: '#ffd700',
        typeClass: 'sucesso-extremo'
      };
    }

    // Limiares conforme a Zona de Acerto:
    // Reduzida: 10+
    // Normal: 13+
    // Aumentada: 16+
    let threshold = 13;
    if (zona === 'reduzida') threshold = 10;
    if (zona === 'aumentada') threshold = 16;

    if (finalTotal >= threshold) {
      return {
        verdict: '✓ SUCESSO REGULAR',
        color: '#00e676',
        typeClass: 'sucesso'
      };
    } else {
      return {
        verdict: '✗ FALHA REGULAR',
        color: '#ff7849',
        typeClass: 'falha'
      };
    }
  }

  function rollAttributeCheck(attrKey, attrDisplayName) {
    const s = getActiveSheet();
    const attrValue = Number(s.attributes[attrKey] || 0);
    const naturalD20 = Math.floor(Math.random() * 20) + 1;
    const finalTotal = naturalD20 + attrValue;
    const evalResult = evaluateOblivioRoll(naturalD20, finalTotal, s.zona);

    // Audio
    if (window.soundFX) {
      window.soundFX.playDiceRoll();
      setTimeout(() => {
        if (evalResult.typeClass === 'sucesso-extremo') window.soundFX.playSuccess();
        else if (evalResult.typeClass === 'falha-extrema') window.soundFX.playFailure();
      }, 250);
    }

    // Exibir Toast
    showDiceToast(`
      <div style="font-family:var(--font-serif); font-size:0.8rem; color:#d4af37;">TESTE DE ${attrDisplayName} (${s.zona.toUpperCase()})</div>
      <div style="font-size:2rem; font-weight:900; line-height:1; margin:4px 0;">${finalTotal}</div>
      <div style="font-size:0.75rem; color:#bbb;">Dado [${naturalD20}] ${attrValue >= 0 ? '+' : ''}${attrValue}</div>
      <div style="font-size:0.88rem; font-weight:bold; margin-top:4px; color:${evalResult.color}">${evalResult.verdict}</div>
    `);

    // Adicionar ao Histórico
    addHistoryEntry({
      title: `Teste de ${attrDisplayName}`,
      total: `${finalTotal}`,
      formula: `1d20 [${naturalD20}] ${attrValue >= 0 ? '+' : ''}${attrValue} = ${finalTotal}`,
      zonaText: `Zona: ${s.zona.toUpperCase()}`,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass
    });
  }

  function rollKnowledgeCheck(name, attrKey, bonus) {
    const s = getActiveSheet();
    const attrVal = Number(s.attributes[attrKey] || 0);
    const totalMod = attrVal + Number(bonus || 0);
    const naturalD20 = Math.floor(Math.random() * 20) + 1;
    const finalTotal = naturalD20 + totalMod;
    const evalResult = evaluateOblivioRoll(naturalD20, finalTotal, s.zona);

    if (window.soundFX) {
      window.soundFX.playDiceRoll();
      setTimeout(() => {
        if (evalResult.typeClass === 'sucesso-extremo') window.soundFX.playSuccess();
        else if (evalResult.typeClass === 'falha-extrema') window.soundFX.playFailure();
      }, 250);
    }

    showDiceToast(`
      <div style="font-family:var(--font-serif); font-size:0.8rem; color:#d4af37;">CONHECIMENTO: ${escapeHtml(name)}</div>
      <div style="font-size:2rem; font-weight:900; line-height:1; margin:4px 0;">${finalTotal}</div>
      <div style="font-size:0.75rem; color:#bbb;">1d20 [${naturalD20}] + ${attrKey.toUpperCase()}(${attrVal}) + Bônus(${bonus})</div>
      <div style="font-size:0.88rem; font-weight:bold; margin-top:4px; color:${evalResult.color}">${evalResult.verdict}</div>
    `);

    addHistoryEntry({
      title: `Conhecimento: ${name}`,
      total: `${finalTotal}`,
      formula: `1d20 [${naturalD20}] + Mod(${totalMod}) = ${finalTotal}`,
      zonaText: `Zona: ${s.zona.toUpperCase()}`,
      verdict: evalResult.verdict,
      verdictColor: evalResult.color,
      typeClass: evalResult.typeClass
    });
  }

  // --- Mecânica: Rolar Corpo (Local de Impacto) ---
  function rollBodyHitLocation() {
    // Rolagem d20 para partes do corpo em Oblívio:
    // 1-4: Perna Direita
    // 5-8: Perna Esquerda
    // 9-14: Torso (Cabeça e Tronco)
    // 15-17: Braço Direito
    // 18-20: Braço Esquerdo
    const roll = Math.floor(Math.random() * 20) + 1;
    let limbKey = 'torso';
    let limbName = 'Torso';

    if (roll >= 1 && roll <= 4) {
      limbKey = 'legRight';
      limbName = 'Perna Direita';
    } else if (roll >= 5 && roll <= 8) {
      limbKey = 'legLeft';
      limbName = 'Perna Esquerda';
    } else if (roll >= 9 && roll <= 14) {
      limbKey = 'torso';
      limbName = 'Torso';
    } else if (roll >= 15 && roll <= 17) {
      limbKey = 'armRight';
      limbName = 'Braço Direito';
    } else {
      limbKey = 'armLeft';
      limbName = 'Braço Esquerdo';
    }

    if (window.soundFX) {
      window.soundFX.playDiceRoll();
      setTimeout(() => window.soundFX.playHit(), 200);
    }

    // Animação e destaque no SVG
    const kebabLimb = limbToKebab(limbKey);
    const svgLimb = document.getElementById(`svg-limb-${kebabLimb}`);
    if (svgLimb) {
      svgLimb.classList.add('critical-hit');
      setTimeout(() => {
        svgLimb.classList.remove('critical-hit');
      }, 2000);
    }

    // Feedback no painel
    const feedbackEl = document.getElementById('body-roll-feedback');
    if (feedbackEl) {
      feedbackEl.innerHTML = `⚔️ Impacto: <strong>${limbName.toUpperCase()}</strong> (d20: ${roll})`;
    }

    showDiceToast(`
      <div style="font-family:var(--font-serif); font-size:0.8rem; color:#ffd700;">ROLAGEM DE CORPO</div>
      <div style="font-size:1.6rem; font-weight:900; line-height:1.2; margin:4px 0; color:#ff4d4d;">${limbName.toUpperCase()}</div>
      <div style="font-size:0.75rem; color:#bbb;">Resultado no d20: [${roll}]</div>
    `);

    addHistoryEntry({
      title: `Rolar Corpo: ${limbName}`,
      total: limbName,
      formula: `Local de impacto atingido [d20: ${roll}]`,
      zonaText: 'Impacto Corporal',
      verdict: `Região: ${limbName}`,
      verdictColor: '#ff4d4d',
      typeClass: 'sucesso'
    });
  }

  // --- Mecânica: Rolar Dano de Arma ---
  function rollDamageFormula(formula, itemName) {
    if (!formula || formula === '-') return;

    try {
      const match = formula.toLowerCase().replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (!match) {
        alert('Fórmula de dano inválida. Use ex: 1d6, 1d8+2, 2d6-1');
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
      const total = sum + mod;

      if (window.soundFX) window.soundFX.playDiceRoll();

      showDiceToast(`
        <div style="font-family:var(--font-serif); font-size:0.8rem; color:#ff7849;">DANO: ${escapeHtml(itemName)}</div>
        <div style="font-size:2.2rem; font-weight:900; line-height:1; margin:4px 0; color:#ff6e40;">${total}</div>
        <div style="font-size:0.75rem; color:#bbb;">${count}d${sides} [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}</div>
      `);

      addHistoryEntry({
        title: `Dano: ${itemName}`,
        total: `${total}`,
        formula: `${count}d${sides} [${rolls.join('+')}] ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''} = ${total}`,
        zonaText: 'Rolagem de Dano',
        verdict: `${total} de Dano`,
        verdictColor: '#ff6e40',
        typeClass: 'sucesso'
      });
    } catch (e) {
      console.error(e);
    }
  }

  // --- Toast de Rolagem ---
  function showDiceToast(htmlContent) {
    const toast = document.getElementById('dice-toast');
    const content = document.getElementById('toast-content');
    if (!toast || !content) return;

    content.innerHTML = htmlContent;
    toast.classList.add('show');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // --- Histórico de Rolagens ---
  function addHistoryEntry(entry) {
    const s = getActiveSheet();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog = {
      id: 'log_' + Date.now(),
      timestamp: timeStr,
      personaName: s.name || 'Persona',
      ...entry
    };

    state.history.unshift(newLog);
    if (state.history.length > 80) state.history.pop();
    saveRollHistory();
    renderHistoryModal();
  }

  // --- Rolador Livre de Dados (Modal) ---
  function executeFreeDiceRoll() {
    const count = Math.max(1, parseInt(document.getElementById('dice-count').value, 10) || 1);
    const die = state.selectedDiceType || 20;
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

  // --- Handlers de Eventos ---
  function setupEventListeners() {
    
    // --- Troca e Criação de Fichas ---
    const sheetSelect = document.getElementById('sheet-select');
    if (sheetSelect) {
      sheetSelect.addEventListener('change', e => {
        state.activeSheetId = e.target.value;
        saveSheetsToStorage();
        renderAll();
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
        const init = s.initialAbility || { name: 'Voracidade', type: '(EFEITO PASSIVO)', desc: '' };
        const newName = prompt('Nome da Habilidade Inicial:', init.name);
        if (newName === null) return;
        const newType = prompt('Tipo (ex: (EFEITO PASSIVO), AÇÃO):', init.type);
        if (newType === null) return;
        const newDesc = prompt('Descrição dos efeitos:', init.desc);
        if (newDesc === null) return;

        s.initialAbility = {
          name: newName.trim() || 'Habilidade',
          type: newType.trim() || '(EFEITO)',
          desc: newDesc.trim()
        };
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
          // Editar
          const target = s.abilities.find(a => a.id === id);
          if (target) {
            target.name = name;
            target.type = type;
            target.cost = cost;
            target.desc = desc;
          }
        } else {
          // Adicionar
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

    // Edição do Estresse Máximo ao clicar no valor máximo
    const limbs = ['armRight', 'armLeft', 'torso', 'legRight', 'legLeft'];
    limbs.forEach(limb => {
      const maxSpan = document.getElementById(`val-${limb}-max`);
      if (maxSpan) {
        maxSpan.style.cursor = 'pointer';
        maxSpan.title = 'Clique para alterar o Estresse Máximo desta região';
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

    // Checkboxes dos Membros
    document.querySelectorAll('.limb-check-title input[type="checkbox"]').forEach(chk => {
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
      });
    });

    // Hover sobre caixas de membros destaca o SVG correspondente
    document.querySelectorAll('.limb-box').forEach(box => {
      box.addEventListener('mouseenter', () => {
        const limb = box.dataset.limb;
        const svgLimb = document.getElementById(`svg-limb-${limb}`);
        if (svgLimb) svgLimb.classList.add('highlight');
      });
      box.addEventListener('mouseleave', () => {
        const limb = box.dataset.limb;
        const svgLimb = document.getElementById(`svg-limb-${limb}`);
        if (svgLimb) svgLimb.classList.remove('highlight');
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
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    document.querySelectorAll('.btn-attr-roll').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const name = btn.dataset.name || attr.toUpperCase();
        rollAttributeCheck(attr, name);
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
        if (window.soundFX) window.soundFX.playClick();
      });
    });

    // --- Inventário: Slots de Carga Guardados ---
    const slotsBoxes = document.getElementById('slots-boxes');
    if (slotsBoxes) {
      slotsBoxes.addEventListener('click', e => {
        const box = e.target.closest('.slot-box');
        if (!box) return;
        const idx = parseInt(box.dataset.index, 10);
        const s = getActiveSheet();
        if (!s.inventory.slotsUsed) s.inventory.slotsUsed = [false, false, false, false, false];

        s.inventory.slotsUsed[idx] = !s.inventory.slotsUsed[idx];
        renderInventory();
        triggerAutoSave();
        if (window.soundFX) window.soundFX.playClick();
      });
    }

    // --- Inventário: Itens Adicionar/Editar/Excluir/Usar ---
    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        openModal('modal-item');
        document.getElementById('item-modal-title').textContent = 'ADICIONAR ITEM';
        document.getElementById('form-item').reset();
        document.getElementById('item-id').value = '';
      });
    }

    const formItem = document.getElementById('form-item');
    if (formItem) {
      formItem.addEventListener('submit', e => {
        e.preventDefault();
        const s = getActiveSheet();
        const id = document.getElementById('item-id').value;
        const cat = document.getElementById('item-category').value;
        const name = document.getElementById('item-name').value.trim();
        const type = document.getElementById('item-type').value.trim();
        const damage = document.getElementById('item-damage').value.trim();
        const stress = document.getElementById('item-stress').value.trim();
        const burden = parseInt(document.getElementById('item-burden').value, 10) || 1;
        const uses = document.getElementById('item-uses').value.trim();
        const desc = document.getElementById('item-desc').value.trim();

        if (cat === 'carregado') {
          if (id) {
            const item = s.inventory.carregados.find(i => i.id === id);
            if (item) {
              item.name = name;
              item.damage = damage;
              item.stress = stress;
              item.desc = desc;
            }
          } else {
            s.inventory.carregados.push({
              id: 'inv_' + Date.now(),
              name,
              damage,
              stress,
              desc
            });
          }
        } else {
          if (id) {
            const item = s.inventory.guardados.find(i => i.id === id);
            if (item) {
              item.name = name;
              item.type = type;
              item.burden = burden;
              item.uses = uses;
              item.desc = desc;
            }
          } else {
            s.inventory.guardados.push({
              id: 'inv_' + Date.now(),
              type,
              name,
              burden,
              uses,
              desc
            });
          }
        }

        closeModal('modal-item');
        renderInventory();
        triggerAutoSave();
      });
    }

    // Ações de itens na tabela (Usar, Dano, Editar, Deletar)
    document.addEventListener('click', e => {
      const s = getActiveSheet();

      // Botão USAR item
      const useBtn = e.target.closest('.btn-use-item');
      if (useBtn) {
        const id = useBtn.dataset.id;
        const item = s.inventory.carregados.find(i => i.id === id);
        if (item) {
          if (item.damage && item.damage !== '-') {
            rollDamageFormula(item.damage, item.name);
          } else {
            if (window.soundFX) window.soundFX.playClick();
            showDiceToast(`
              <div style="font-family:var(--font-serif); font-size:0.8rem; color:#aaa;">USO DE ITEM</div>
              <div style="font-size:1.4rem; font-weight:700; margin:4px 0;">${escapeHtml(item.name)}</div>
              <div style="font-size:0.75rem; color:#bbb;">${escapeHtml(item.desc || 'Item utilizado.')}</div>
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
        const id = editItemBtn.dataset.id;
        const cat = editItemBtn.dataset.cat;
        let item = null;
        if (cat === 'carregado') item = s.inventory.carregados.find(i => i.id === id);
        else item = s.inventory.guardados.find(i => i.id === id);

        if (item) {
          openModal('modal-item');
          document.getElementById('item-modal-title').textContent = 'EDITAR ITEM';
          document.getElementById('item-id').value = item.id;
          document.getElementById('item-category').value = cat;
          document.getElementById('item-name').value = item.name;
          document.getElementById('item-type').value = item.type || '';
          document.getElementById('item-damage').value = item.damage || '';
          document.getElementById('item-stress').value = item.stress || '';
          document.getElementById('item-burden').value = item.burden || 1;
          document.getElementById('item-uses').value = item.uses || '';
          document.getElementById('item-desc').value = item.desc || '';
        }
      }

      // Botão Deletar Item
      const delItemBtn = e.target.closest('.delete-item');
      if (delItemBtn) {
        const id = delItemBtn.dataset.id;
        const cat = delItemBtn.dataset.cat;
        if (confirm('Remover este item?')) {
          if (cat === 'carregado') {
            s.inventory.carregados = s.inventory.carregados.filter(i => i.id !== id);
          } else {
            s.inventory.guardados = s.inventory.guardados.filter(i => i.id !== id);
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
