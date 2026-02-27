class CPShoppingList {
  constructor() {
    this.lists = [];
    this.currentListId = null;
    this.booths = [];
    this.currentFilter = 'all';
    this.editingBoothId = null;
    this.editingListId = null;
    this.tempImages = [];
    this.tempProducts = [];
    this.dragState = { active: false, startY: 0, currentCard: null };
    this.swipeState = { startX: 0, currentCard: null };
    this.batchMode = false;
    this.selectedBooths = new Set();
    this.expandedBooths = new Set();
    this._cardTouchState = { startY: 0, startX: 0, isScrolling: false, longPressTimer: null, isDragging: false, isTouchActive: false, lastTapTime: 0, activeCard: null };
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.bindEvents();
    this.bindCardEventsDelegated();
    
    if (!this.loadFromShareLink()) {
      this.render();
      this.renderListMenu();
      this.updateListName();
    } else {
      this.render();
      this.renderListMenu();
      this.updateListName();
    }
  }

  async loadData() {
    try {
      const savedLists = localStorage.getItem('cp-shopping-lists');
      if (savedLists) {
        this.lists = JSON.parse(savedLists);
      }
      
      if (this.lists.length === 0) {
        const defaultList = {
          id: 'default',
          name: 'CP购物单',
          createdAt: Date.now()
        };
        this.lists.push(defaultList);
        this.saveListsData();
      }

      const savedCurrentList = localStorage.getItem('cp-current-list');
      this.currentListId = savedCurrentList || this.lists[0].id;

      const savedBooths = localStorage.getItem(`cp-booths-${this.currentListId}`);
      if (savedBooths) {
        this.booths = JSON.parse(savedBooths);
      } else {
        const oldData = localStorage.getItem('cp-shopping-list');
        if (oldData && this.currentListId === 'default') {
          this.booths = JSON.parse(oldData);
          this.saveData();
        }
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      this.booths = [];
    }
  }

  saveData() {
    try {
      localStorage.setItem(`cp-booths-${this.currentListId}`, JSON.stringify(this.booths));
    } catch (e) {
      console.error('Failed to save data:', e);
      this.showToast('保存失败');
    }
  }

  saveListsData() {
    try {
      localStorage.setItem('cp-shopping-lists', JSON.stringify(this.lists));
      localStorage.setItem('cp-current-list', this.currentListId);
    } catch (e) {
      console.error('Failed to save lists:', e);
    }
  }

  switchList(listId) {
    this.saveData();
    this.currentListId = listId;
    const savedBooths = localStorage.getItem(`cp-booths-${listId}`);
    this.booths = savedBooths ? JSON.parse(savedBooths) : [];
    this.saveListsData();
    this.render();
    this.renderListMenu();
    this.updateListName();
    this.exitBatchMode();
    document.getElementById('listMenu').classList.remove('active');
  }

  updateListName() {
    const list = this.lists.find(l => l.id === this.currentListId);
    document.getElementById('currentListName').textContent = list ? list.name : 'CP购物单';
  }

  renderListMenu() {
    const container = document.getElementById('listItems');
    container.innerHTML = this.lists.map(list => {
      const boothCount = this.getListBoothCount(list.id);
      return `
        <div class="list-item ${list.id === this.currentListId ? 'active' : ''}" data-id="${list.id}">
          <span class="list-name">${this.escapeHtml(list.name)}</span>
          <span class="list-count">${boothCount}个摊位</span>
          <button class="list-edit" onclick="event.stopPropagation(); app.openListModal('${list.id}')">
            <i class="fas fa-pen"></i>
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        this.switchList(item.dataset.id);
      });
    });
  }

  getListBoothCount(listId) {
    if (listId === this.currentListId) return this.booths.length;
    const saved = localStorage.getItem(`cp-booths-${listId}`);
    if (saved) {
      try {
        return JSON.parse(saved).length;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  openListModal(listId = null) {
    this.editingListId = listId;
    const modal = document.getElementById('listModal');
    const title = document.getElementById('listModalTitle');
    const input = document.getElementById('listNameInput');
    const deleteBtn = document.getElementById('deleteListBtn');

    if (listId) {
      const list = this.lists.find(l => l.id === listId);
      title.textContent = '编辑购物单';
      input.value = list ? list.name : '';
      deleteBtn.style.display = this.lists.length > 1 ? 'block' : 'none';
    } else {
      title.textContent = '新建购物单';
      input.value = '';
      deleteBtn.style.display = 'none';
    }

    modal.classList.add('active');
    setTimeout(() => input.focus(), 100);
  }

  saveList() {
    const name = document.getElementById('listNameInput').value.trim();
    if (!name) {
      this.showToast('请输入购物单名称');
      return;
    }

    if (this.editingListId) {
      const list = this.lists.find(l => l.id === this.editingListId);
      if (list) {
        list.name = name;
      }
    } else {
      const newList = {
        id: Date.now().toString(),
        name: name,
        createdAt: Date.now()
      };
      this.lists.push(newList);
      this.switchList(newList.id);
    }

    this.saveListsData();
    this.renderListMenu();
    this.updateListName();
    this.closeAllModals();
    this.showToast(this.editingListId ? '购物单已更新' : '购物单已创建');
  }

  async deleteList() {
    if (this.lists.length <= 1) {
      this.showToast('至少保留一个购物单');
      return;
    }

    const ok = await this.showConfirm('确定删除这个购物单吗？所有摊位数据将被清除。', '删除购物单');
    if (!ok) return;

    localStorage.removeItem(`cp-booths-${this.editingListId}`);
    this.lists = this.lists.filter(l => l.id !== this.editingListId);
    
    if (this.currentListId === this.editingListId) {
      this.switchList(this.lists[0].id);
    }

    this.saveListsData();
    this.renderListMenu();
    this.closeAllModals();
    this.showToast('购物单已删除');
  }

  toggleBatchMode() {
    this.batchMode = !this.batchMode;
    this.selectedBooths.clear();
    document.getElementById('app').classList.toggle('batch-mode', this.batchMode);
    document.getElementById('batchActionBar').classList.toggle('active', this.batchMode);
    this.updateSelectedCount();
    this.render();
  }

  exitBatchMode() {
    this.batchMode = false;
    this.selectedBooths.clear();
    document.getElementById('app').classList.remove('batch-mode');
    document.getElementById('batchActionBar').classList.remove('active');
  }

  toggleBoothSelection(boothId) {
    if (this.selectedBooths.has(boothId)) {
      this.selectedBooths.delete(boothId);
    } else {
      this.selectedBooths.add(boothId);
    }
    this.updateSelectedCount();
    this.render();
  }

  selectAllBooths() {
    if (this.selectedBooths.size === this.booths.length) {
      this.selectedBooths.clear();
    } else {
      this.booths.forEach(b => this.selectedBooths.add(b.id));
    }
    this.updateSelectedCount();
    this.render();
  }

  updateSelectedCount() {
    document.getElementById('selectedCount').textContent = `已选 ${this.selectedBooths.size} 项`;
    const selectAllBtn = document.getElementById('selectAllBtn');
    selectAllBtn.textContent = this.selectedBooths.size === this.booths.length ? '取消全选' : '全选';
  }

  async batchDelete() {
    if (this.selectedBooths.size === 0) {
      this.showToast('请先选择要删除的摊位');
      return;
    }

    const ok = await this.showConfirm(`确定删除选中的 ${this.selectedBooths.size} 个摊位吗？`, '批量删除');
    if (!ok) return;

    const count = this.selectedBooths.size;
    this.booths = this.booths.filter(b => !this.selectedBooths.has(b.id));
    this.saveData();
    this.exitBatchMode();
    this.render();
    this.showToast(`已删除 ${count} 个摊位`);
  }

  bindEvents() {
    const addBtn = document.getElementById('addBtn');
    const addMenu = document.getElementById('addMenu');
    const listMenu = document.getElementById('listMenu');
    const exportMenu = document.getElementById('exportMenu');
    
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addMenu.classList.toggle('active');
      listMenu.classList.remove('active');
      exportMenu.classList.remove('active');
    });

    document.getElementById('exportBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('active');
      addMenu.classList.remove('active');
      listMenu.classList.remove('active');
    });

    exportMenu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        exportMenu.classList.remove('active');
        this.handleExportAction(action);
      });
    });

    document.getElementById('listSwitchBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      listMenu.classList.toggle('active');
      addMenu.classList.remove('active');
      exportMenu.classList.remove('active');
    });

    document.getElementById('newListBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      listMenu.classList.remove('active');
      this.openListModal();
    });

    document.getElementById('saveListBtn').addEventListener('click', () => {
      this.saveList();
    });

    document.getElementById('deleteListBtn').addEventListener('click', () => {
      this.deleteList();
    });

    document.getElementById('batchModeBtn').addEventListener('click', () => {
      this.toggleBatchMode();
    });

    document.getElementById('selectAllBtn').addEventListener('click', () => {
      this.selectAllBooths();
    });

    document.getElementById('batchDeleteBtn').addEventListener('click', () => {
      this.batchDelete();
    });

    document.getElementById('cancelBatchBtn').addEventListener('click', () => {
      this.exitBatchMode();
    });

    document.addEventListener('click', () => {
      addMenu.classList.remove('active');
      listMenu.classList.remove('active');
      exportMenu.classList.remove('active');
    });

    addMenu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        addMenu.classList.remove('active');
        this.handleMenuAction(action);
      });
    });

    document.querySelectorAll('.filter-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.type;
        this.render();
      });
    });

    document.querySelectorAll('.modal .modal-overlay, .modal .btn-close').forEach(el => {
      el.addEventListener('click', () => this.closeAllModals());
    });

    document.querySelectorAll('input[name="boothType"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateBoothNumberHint());
    });

    document.getElementById('addImageBtn').addEventListener('click', () => {
      document.getElementById('imageInput').click();
    });

    document.getElementById('imageInput').addEventListener('change', (e) => {
      this.handleImageUpload(e.target.files);
    });

    document.getElementById('addProductBtn').addEventListener('click', () => {
      this.addProductRow();
    });

    document.getElementById('saveBoothBtn').addEventListener('click', () => {
      this.saveBooth();
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      this.closeAllModals();
    });

    document.getElementById('editBoothBtn').addEventListener('click', () => {
      this.closeAllModals();
      setTimeout(() => this.openEditModal(this.editingBoothId), 100);
    });

    document.getElementById('deleteBoothBtn').addEventListener('click', () => {
      this.deleteBooth(this.editingBoothId);
    });

    document.getElementById('batchCreateBtn').addEventListener('click', () => {
      this.handleBatchCreate();
    });

    document.getElementById('batchInput').addEventListener('input', (e) => {
      this.previewBatchParse(e.target.value);
    });

    document.querySelectorAll('.batch-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.batch-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.batch-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.mode === 'parse' ? 'parsePanel' : 'formPanel').classList.add('active');
        this.currentBatchMode = tab.dataset.mode;
      });
    });

    document.getElementById('addBatchItemBtn').addEventListener('click', () => {
      this.addBatchFormItem();
    });

    document.getElementById('batchFormList').addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-item')) {
        const item = e.target.closest('.batch-form-item');
        if (document.querySelectorAll('.batch-form-item').length > 1) {
          item.remove();
          this.reindexBatchFormItems();
        } else {
          this.showToast('至少保留一条');
        }
      }
    });

    document.getElementById('textImportInput').addEventListener('input', (e) => {
      this.previewTextImport(e.target.value);
    });

    document.getElementById('textImportBtn').addEventListener('click', () => {
      this.handleTextImport();
    });

    document.getElementById('excelInput').addEventListener('change', (e) => {
      this.handleExcelImport(e.target.files[0]);
    });

    document.getElementById('productsBody').addEventListener('input', () => {
      this.calculateTotal();
    });

    this.currentBatchMode = 'parse';
  }

  handleMenuAction(action) {
    switch (action) {
      case 'new-single':
        this.openEditModal();
        break;
      case 'new-batch':
        this.openModal('batchModal');
        break;
      case 'import-excel':
        document.getElementById('excelInput').click();
        break;
      case 'import-text':
        this.openModal('textImportModal');
        break;
    }
  }

  handleExportAction(action) {
    if (this.booths.length === 0) {
      this.showToast('没有可导出的数据');
      return;
    }
    
    switch (action) {
      case 'export-image':
        this.exportAsImage();
        break;
      case 'export-excel':
        this.exportAsExcel();
        break;
      case 'share-link':
        this.generateShareLink();
        break;
    }
  }

  generateShareLink() {
    const list = this.lists.find(l => l.id === this.currentListId);
    const data = {
      name: list ? list.name : 'CP购物单',
      booths: this.booths
    };
    
    try {
      const jsonStr = JSON.stringify(data);
      const compressed = this.compressData(jsonStr);
      const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
      
      if (url.length > 8000) {
        this.showToast('数据量过大，请减少摊位数量');
        return;
      }
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('分享链接已复制到剪贴板');
        }).catch(() => {
          this.showShareLinkModal(url);
        });
      } else {
        this.showShareLinkModal(url);
      }
    } catch (e) {
      console.error('Generate share link error:', e);
      this.showToast('生成链接失败');
    }
  }

  compressData(str) {
    return LZString.compressToEncodedURIComponent(str);
  }

  decompressData(str) {
    // 先尝试 lz-string 解压，失败则回退到旧的 btoa 解码（兼容旧链接）
    try {
      const result = LZString.decompressFromEncodedURIComponent(str);
      if (result) return result;
    } catch (e) {}
    // 回退: 旧的 btoa 格式
    return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }

  showShareLinkModal(url) {
    let modal = document.getElementById('shareLinkModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'shareLinkModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h2>分享链接</h2>
            <button class="btn-icon btn-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">复制以下链接分享给他人：</p>
            <textarea id="shareLinkText" rows="4" style="width: 100%; resize: none; font-size: 12px;" readonly></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="copyShareLinkBtn">复制链接</button>
          </div>
        </div>
      `;
      document.getElementById('app').appendChild(modal);
      
      modal.querySelector('.modal-overlay').addEventListener('click', () => modal.classList.remove('active'));
      modal.querySelector('.btn-close').addEventListener('click', () => modal.classList.remove('active'));
      modal.querySelector('#copyShareLinkBtn').addEventListener('click', () => {
        const textarea = document.getElementById('shareLinkText');
        textarea.select();
        document.execCommand('copy');
        this.showToast('链接已复制');
        modal.classList.remove('active');
      });
    }
    
    document.getElementById('shareLinkText').value = url;
    modal.classList.add('active');
  }

  loadFromShareLink() {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    
    if (!dataParam) return false;
    
    try {
      const jsonStr = this.decompressData(dataParam);
      const data = JSON.parse(jsonStr);
      
      if (data.booths && Array.isArray(data.booths)) {
        const sharedList = {
          id: 'shared_' + Date.now(),
          name: data.name || '分享的购物单',
          createdAt: Date.now()
        };
        
        this.lists.push(sharedList);
        this.currentListId = sharedList.id;
        this.booths = data.booths;
        this.saveListsData();
        this.saveData();
        
        window.history.replaceState({}, '', window.location.pathname);
        
        this.showToast(`已导入: ${sharedList.name}`);
        return true;
      }
    } catch (e) {
      console.error('Load share link error:', e);
      this.showToast('链接数据无效');
    }
    
    return false;
  }

  async exportAsImage() {
    this.showToast('正在生成图片...');
    
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; background: #f9fafb; padding: 20px; width: 400px;';
    
    const list = this.lists.find(l => l.id === this.currentListId);
    const title = document.createElement('h2');
    title.textContent = list ? list.name : 'CP购物单';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #111827; text-align: center;';
    container.appendChild(title);

    const sorted = this.getSortedBoothsForExport();
    const groups = this.groupByVenue(sorted);

    groups.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.style.cssText = 'margin-bottom: 16px;';
      
      const header = document.createElement('div');
      header.textContent = `${group.label} (${group.booths.length}个摊位)`;
      header.style.cssText = 'font-size: 14px; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;';
      groupDiv.appendChild(header);

      group.booths.forEach(booth => {
        const boothDiv = document.createElement('div');
        boothDiv.style.cssText = 'background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
        
        const boothHeader = document.createElement('div');
        boothHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        
        const boothInfo = document.createElement('div');
        const numberSpan = document.createElement('span');
        numberSpan.textContent = booth.number;
        numberSpan.style.cssText = 'font-weight: 600; color: #4b5563; margin-right: 8px;';
        boothInfo.appendChild(numberSpan);
        
        if (booth.name) {
          const nameSpan = document.createElement('span');
          nameSpan.textContent = booth.name;
          nameSpan.style.cssText = 'color: #111827;';
          boothInfo.appendChild(nameSpan);
        }
        boothHeader.appendChild(boothInfo);
        
        if (booth.products && booth.products.length > 0) {
          const total = this.calculateBoothTotal(booth);
          const totalSpan = document.createElement('span');
          totalSpan.textContent = `¥${total.toFixed(0)}`;
          totalSpan.style.cssText = 'font-weight: 600; color: #111827;';
          boothHeader.appendChild(totalSpan);
        }
        boothDiv.appendChild(boothHeader);

        if (booth.zone) {
          const zoneDiv = document.createElement('div');
          zoneDiv.textContent = booth.zone;
          zoneDiv.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 8px;';
          boothDiv.appendChild(zoneDiv);
        }

        if (booth.products && booth.products.length > 0) {
          booth.products.forEach(p => {
            const pDiv = document.createElement('div');
            pDiv.style.cssText = 'display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-top: 1px dashed #e5e7eb;';
            
            const statusIcon = p.status === 'bought' ? '✓' : (p.status === 'missed' ? '✗' : '○');
            const statusColor = p.status === 'bought' ? '#16a34a' : (p.status === 'missed' ? '#dc2626' : '#9ca3af');
            
            const left = document.createElement('span');
            left.innerHTML = `<span style="color: ${statusColor}; margin-right: 4px;">${statusIcon}</span>${this.escapeHtml(p.name)}`;
            pDiv.appendChild(left);
            
            const right = document.createElement('span');
            right.textContent = `¥${p.price} ×${p.quantity}`;
            right.style.cssText = 'color: #6b7280;';
            pDiv.appendChild(right);
            
            boothDiv.appendChild(pDiv);
          });
        }

        groupDiv.appendChild(boothDiv);
      });

      container.appendChild(groupDiv);
    });

    const footer = document.createElement('div');
    const grandTotal = sorted.reduce((sum, b) => sum + this.calculateBoothTotal(b), 0);
    footer.textContent = `共 ${sorted.length} 个摊位，总计 ¥${grandTotal.toFixed(0)}`;
    footer.style.cssText = 'text-align: center; color: #6b7280; font-size: 14px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;';
    container.appendChild(footer);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#f9fafb' });
      const link = document.createElement('a');
      link.download = `${list ? list.name : 'CP购物单'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('图片已保存');
    } catch (e) {
      console.error('Export image error:', e);
      this.showToast('导出失败');
    } finally {
      document.body.removeChild(container);
    }
  }

  exportAsExcel() {
    const sorted = this.getSortedBoothsForExport();
    const list = this.lists.find(l => l.id === this.currentListId);
    
    const data = [];
    data.push(['摊位号', '摊位名', '专区/IP', '制品', '价格', '数量', '状态', '备注']);
    
    sorted.forEach(booth => {
      if (booth.products && booth.products.length > 0) {
        booth.products.forEach((p, idx) => {
          const statusLabel = p.status === 'bought' ? '✓' : (p.status === 'missed' ? '✗' : '');
          data.push([
            idx === 0 ? booth.number : '',
            idx === 0 ? (booth.name || '') : '',
            idx === 0 ? (booth.zone || '') : '',
            p.name,
            p.price,
            p.quantity,
            statusLabel,
            idx === 0 ? (booth.note || '') : (p.statusNote || '')
          ]);
        });
      } else {
        data.push([
          booth.number,
          booth.name || '',
          booth.zone || '',
          '',
          '',
          '',
          '',
          booth.note || ''
        ]);
      }
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    ws['!cols'] = [
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
      { wch: 8 },
      { wch: 6 },
      { wch: 6 },
      { wch: 20 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, '购物单');
    XLSX.writeFile(wb, `${list ? list.name : 'CP购物单'}.xlsx`);
    this.showToast('Excel已保存');
  }

  getSortedBoothsForExport() {
    const pinnedBooths = this.booths.filter(b => b.pinned);
    const unpinned = this.booths.filter(b => !b.pinned);
    const sorted = this.sortBooths([...unpinned]);
    return [...pinnedBooths, ...sorted];
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    this.editingBoothId = null;
    this.tempImages = [];
    this.tempProducts = [];
  }

  openEditModal(boothId = null) {
    this.editingBoothId = boothId;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('editTitle');
    const form = document.getElementById('boothForm');

    if (boothId) {
      title.textContent = '编辑摊位';
      const booth = this.booths.find(b => b.id === boothId);
      if (booth) {
        form.querySelector(`input[name="boothType"][value="${booth.type}"]`).checked = true;
        document.getElementById('boothNumber').value = booth.number;
        document.getElementById('boothName').value = booth.name;
        document.getElementById('boothZone').value = booth.zone || '';
        document.getElementById('boothNote').value = booth.note || '';
        this.tempImages = [...(booth.images || [])];
        this.tempProducts = [...(booth.products || [])];
      }
    } else {
      title.textContent = '新建摊位';
      form.reset();
      form.querySelector('input[name="boothType"][value="doujin"]').checked = true;
      this.tempImages = [];
      this.tempProducts = [];
    }

    this.renderNoteImages();
    this.renderProductRows();
    this.updateBoothNumberHint();
    this.calculateTotal();
    modal.classList.add('active');
  }

  openDetailModal(boothId) {
    this.editingBoothId = boothId;
    const booth = this.booths.find(b => b.id === boothId);
    if (!booth) return;

    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailBody');
    const typeLabel = this.getTypeLabel(booth.type);
    const venueLabel = this.getVenueLabel(booth);

    let productsHtml = '';
    if (booth.products && booth.products.length > 0) {
      productsHtml = booth.products.map(p => {
        const statusLabel = p.status === 'bought' ? '✓ 已买' : (p.status === 'missed' ? '✗ 未买到' : '');
        const statusClass = p.status === 'bought' ? 'status-bought' : (p.status === 'missed' ? 'status-missed' : '');
        return `
          <div class="detail-product-row ${statusClass}">
            <span class="detail-product-name">${this.escapeHtml(p.name)}</span>
            <span class="detail-product-status">${statusLabel}</span>
            <span class="detail-product-price">¥${(p.price || 0).toFixed(2)}</span>
            <span class="detail-product-qty">×${p.quantity || 1}</span>
          </div>
          ${p.status === 'missed' && p.statusNote ? `<div class="detail-product-note">${this.escapeHtml(p.statusNote)}</div>` : ''}
        `;
      }).join('');
    }

    let imagesHtml = '';
    if (booth.images && booth.images.length > 0) {
      imagesHtml = `
        <div class="detail-note-images">
          ${booth.images.map(img => `<img src="${img}" onclick="app.viewImage('${img}')">`).join('')}
        </div>
      `;
    }

    const total = this.calculateBoothTotal(booth);
    const boughtCount = booth.products?.filter(p => p.status === 'bought').length || 0;
    const totalCount = booth.products?.length || 0;

    body.innerHTML = `
      <div class="detail-header">
        <div class="booth-number ${booth.type}">
          <span class="number">${booth.number}</span>
          <span class="venue">${venueLabel}</span>
        </div>
        <div class="booth-info">
          <h2>${this.escapeHtml(booth.name)}</h2>
          <p><span class="venue-badge ${booth.type}">${typeLabel}</span> ${booth.zone ? `· ${this.escapeHtml(booth.zone)}` : ''}</p>
        </div>
      </div>
      ${booth.note ? `
        <div class="detail-section">
          <h3>备注</h3>
          <p>${this.escapeHtml(booth.note)}</p>
          ${imagesHtml}
        </div>
      ` : (booth.images?.length ? `<div class="detail-section"><h3>图片</h3>${imagesHtml}</div>` : '')}
      ${booth.products && booth.products.length > 0 ? `
        <div class="detail-section">
          <h3>制品清单 <span class="detail-progress">${boughtCount}/${totalCount}</span></h3>
          <div class="detail-products">
            ${productsHtml}
            <div class="detail-total">
              <span>总计</span>
              <span class="amount">¥${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    modal.classList.add('active');
  }

  viewImage(src) {
    let viewer = document.querySelector('.image-viewer');
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.className = 'image-viewer';
      viewer.innerHTML = `
        <button class="close-btn"><i class="fas fa-times"></i></button>
        <img src="">
      `;
      viewer.addEventListener('click', () => viewer.classList.remove('active'));
      document.body.appendChild(viewer);
    }
    viewer.querySelector('img').src = src;
    viewer.classList.add('active');
  }

  updateBoothNumberHint() {
    const type = document.querySelector('input[name="boothType"]:checked').value;
    const hint = document.getElementById('boothNumberHint');
    const zoneGroup = document.getElementById('boothZone').closest('.form-group');
    
    switch (type) {
      case 'doujin':
        hint.textContent = '同人馆格式: 大写数字+字母-数字 (如: 壹A-01)';
        zoneGroup.style.display = '';
        break;
      case 'enterprise':
        hint.textContent = '企业馆格式: CP+字母+数字 (如: CPA01, CPB02)';
        zoneGroup.style.display = 'none';
        break;
      case 'creative':
        hint.textContent = '创摊格式: 创+数字 (如: 创01, 创123)';
        zoneGroup.style.display = 'none';
        break;
    }
  }

  handleImageUpload(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.tempImages.push(e.target.result);
        this.renderNoteImages();
      };
      reader.readAsDataURL(file);
    });
  }

  renderNoteImages() {
    const container = document.getElementById('noteImages');
    container.innerHTML = this.tempImages.map((img, idx) => `
      <div class="note-image">
        <img src="${img}">
        <button type="button" class="remove-btn" onclick="app.removeImage(${idx})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }

  removeImage(idx) {
    this.tempImages.splice(idx, 1);
    this.renderNoteImages();
  }

  addProductRow(product = { name: '', price: 0, quantity: 1, status: 'pending', statusNote: '' }) {
    this.tempProducts.push(product);
    this.renderProductRows();
  }

  renderProductRows() {
    const container = document.getElementById('productsBody');
    container.innerHTML = this.tempProducts.map((p, idx) => {
      const statusClass = p.status === 'bought' ? 'bought' : (p.status === 'missed' ? 'missed' : '');
      const selectClass = `status-${p.status || 'pending'}`;
      return `
        <div class="product-row ${statusClass}" data-idx="${idx}">
          <input type="text" value="${this.escapeHtml(p.name || '')}" placeholder="名称" class="product-name">
          <input type="number" value="${p.price || 0}" placeholder="价格" min="0" step="0.01" class="product-price">
          <input type="number" value="${p.quantity || 1}" placeholder="数量" min="1" class="product-qty">
          <select class="product-status ${selectClass}" onchange="app.onProductStatusChange(${idx}, this)">
            <option value="pending" ${p.status !== 'bought' && p.status !== 'missed' ? 'selected' : ''}>待购</option>
            <option value="bought" ${p.status === 'bought' ? 'selected' : ''}>已买</option>
            <option value="missed" ${p.status === 'missed' ? 'selected' : ''}>未买到</option>
          </select>
          <button type="button" class="remove-product" onclick="app.removeProduct(${idx})">
            <i class="fas fa-times"></i>
          </button>
        </div>
        ${p.status === 'missed' ? `
          <div class="product-status-note" data-idx="${idx}">
            <input type="text" value="${this.escapeHtml(p.statusNote || '')}" placeholder="未买到原因..." class="status-note-input" onchange="app.onStatusNoteChange(${idx}, this.value)">
          </div>
        ` : ''}
      `;
    }).join('');
    this.calculateTotal();
  }

  onProductStatusChange(idx, select) {
    if (this.tempProducts[idx]) {
      this.tempProducts[idx].status = select.value;
      select.className = `product-status status-${select.value}`;
      this.renderProductRows();
    }
  }

  onStatusNoteChange(idx, value) {
    if (this.tempProducts[idx]) {
      this.tempProducts[idx].statusNote = value;
    }
  }

  removeProduct(idx) {
    this.tempProducts.splice(idx, 1);
    this.renderProductRows();
  }

  calculateTotal() {
    const rows = document.querySelectorAll('.product-row');
    let total = 0;
    rows.forEach((row, idx) => {
      const price = parseFloat(row.querySelector('.product-price').value) || 0;
      const qty = parseInt(row.querySelector('.product-qty').value) || 0;
      total += price * qty;
      if (this.tempProducts[idx]) {
        this.tempProducts[idx].name = row.querySelector('.product-name').value;
        this.tempProducts[idx].price = price;
        this.tempProducts[idx].quantity = qty;
      }
    });
    document.getElementById('totalPrice').textContent = `¥${total.toFixed(2)}`;
    return total;
  }

  calculateBoothTotal(booth) {
    if (!booth.products || booth.products.length === 0) return 0;
    return booth.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  }

  saveBooth() {
    const type = document.querySelector('input[name="boothType"]:checked').value;
    const number = document.getElementById('boothNumber').value.trim();
    const name = document.getElementById('boothName').value.trim();
    const zone = document.getElementById('boothZone').value.trim();
    const note = document.getElementById('boothNote').value.trim();


    this.calculateTotal();
    const products = this.tempProducts.filter(p => p.name.trim());

    const booth = {
      id: this.editingBoothId || Date.now().toString(),
      type,
      number,
      name,
      zone,
      note,
      images: [...this.tempImages],
      products,
      pinned: false,
      createdAt: this.editingBoothId ? 
        (this.booths.find(b => b.id === this.editingBoothId)?.createdAt || Date.now()) : 
        Date.now()
    };

    if (this.editingBoothId) {
      const existingBooth = this.booths.find(b => b.id === this.editingBoothId);
      booth.pinned = existingBooth?.pinned || false;
      const idx = this.booths.findIndex(b => b.id === this.editingBoothId);
      if (idx !== -1) {
        this.booths[idx] = booth;
      }
    } else {
      this.booths.push(booth);
    }

    this.saveData();
    this.closeAllModals();
    this.render();
    this.showToast(this.editingBoothId ? '摊位已更新' : '摊位已创建');
  }

  async deleteBooth(boothId) {
    const ok = await this.showConfirm('确定删除这个摊位吗？', '删除摊位');
    if (!ok) return;
    
    this.booths = this.booths.filter(b => b.id !== boothId);
    this.saveData();
    this.closeAllModals();
    this.render();
    this.showToast('摊位已删除');
  }

  togglePin(boothId) {
    const booth = this.booths.find(b => b.id === boothId);
    if (booth) {
      booth.pinned = !booth.pinned;
      this.saveData();
      this.render();
      this.showToast(booth.pinned ? '已置顶' : '已取消置顶');
    }
  }

  handleBatchCreate() {
    if (this.currentBatchMode === 'parse') {
      this.handleBatchParse();
    } else {
      this.handleBatchForm();
    }
  }

  handleBatchParse() {
    const input = document.getElementById('batchInput').value.trim();
    
    if (!input) {
      this.showToast('请输入摊位信息');
      return;
    }

    const parsed = this.parseText(input);
    
    if (parsed.length === 0) {
      this.showToast('未识别到有效摊位信息');
      return;
    }

    parsed.forEach(item => {
      const booth = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: item.type,
        number: item.number,
        name: item.name,
        zone: item.zone || '',
        note: '',
        images: [],
        products: [],
        pinned: false,
        createdAt: Date.now()
      };
      this.booths.push(booth);
    });

    this.saveData();
    this.closeAllModals();
    this.render();
    this.showToast(`成功创建 ${parsed.length} 个摊位`);
    document.getElementById('batchInput').value = '';
    document.getElementById('batchPreviewList').innerHTML = '<p class="hint">输入文本后自动预览识别结果</p>';
  }

  handleBatchForm() {
    const type = document.querySelector('input[name="batchType"]:checked').value;
    const items = document.querySelectorAll('.batch-form-item');
    let created = 0;

    items.forEach(item => {
      const number = item.querySelector('.batch-number').value.trim();
      const name = item.querySelector('.batch-name').value.trim();
      const zone = item.querySelector('.batch-zone').value.trim();

      if (number && name) {
        const booth = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          type,
          number,
          name,
          zone,
          note: '',
          images: [],
          products: [],
          pinned: false,
          createdAt: Date.now()
        };
        this.booths.push(booth);
        created++;
      }
    });

    if (created > 0) {
      this.saveData();
      this.closeAllModals();
      this.render();
      this.showToast(`成功创建 ${created} 个摊位`);
      this.resetBatchForm();
    } else {
      this.showToast('请至少填写一个摊位的摊位号和名称');
    }
  }

  previewBatchParse(text) {
    const container = document.getElementById('batchPreviewList');
    const countEl = document.getElementById('parseCount');
    
    if (!text.trim()) {
      container.innerHTML = '<p class="hint">输入文本后自动预览识别结果</p>';
      countEl.textContent = '';
      return;
    }

    const parsed = this.parseText(text);
    
    if (parsed.length === 0) {
      container.innerHTML = '<p class="hint">未识别到摊位信息，请检查格式</p>';
      countEl.textContent = '';
      return;
    }

    const totalProducts = parsed.reduce((sum, item) => sum + (item.products?.length || 0), 0);
    countEl.textContent = totalProducts > 0 ? `(${parsed.length}摊位, ${totalProducts}制品)` : `(${parsed.length}条)`;
    
    container.innerHTML = parsed.map(item => {
      const productsHtml = item.products && item.products.length > 0 
        ? `<div class="preview-products">${item.products.map(p => 
            `<span class="preview-product">${this.escapeHtml(p.name)} ¥${p.price}${p.quantity > 1 ? ' ×' + p.quantity : ''}</span>`
          ).join('')}</div>`
        : '';
      return `
        <div class="preview-item ${item.products?.length ? 'has-products' : ''}">
          <span class="number">${item.number}</span>
          <span class="name">${this.escapeHtml(item.name)}</span>
          <span class="type">${this.getTypeLabel(item.type)}</span>
          ${productsHtml}
        </div>
      `;
    }).join('');
  }

  addBatchFormItem() {
    const list = document.getElementById('batchFormList');
    const index = list.children.length;
    const itemHtml = `
      <div class="batch-form-item" data-index="${index}">
        <div class="batch-form-row">
          <input type="text" class="batch-number" placeholder="摊位号 *">
          <input type="text" class="batch-name" placeholder="摊位名称 *">
        </div>
        <div class="batch-form-row">
          <input type="text" class="batch-zone" placeholder="专区/IP (可选)">
          <button type="button" class="btn-remove-item" title="删除">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
    list.insertAdjacentHTML('beforeend', itemHtml);
    list.lastElementChild.querySelector('.batch-number').focus();
  }

  reindexBatchFormItems() {
    document.querySelectorAll('.batch-form-item').forEach((item, idx) => {
      item.dataset.index = idx;
    });
  }

  resetBatchForm() {
    const list = document.getElementById('batchFormList');
    list.innerHTML = `
      <div class="batch-form-item" data-index="0">
        <div class="batch-form-row">
          <input type="text" class="batch-number" placeholder="摊位号 *">
          <input type="text" class="batch-name" placeholder="摊位名称 *">
        </div>
        <div class="batch-form-row">
          <input type="text" class="batch-zone" placeholder="专区/IP (可选)">
          <button type="button" class="btn-remove-item" title="删除">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  previewTextImport(text) {
    const container = document.getElementById('textPreviewList');
    if (!text.trim()) {
      container.innerHTML = '<p class="hint">输入文本后自动预览识别结果</p>';
      return;
    }

    const parsed = this.parseText(text);
    if (parsed.length === 0) {
      container.innerHTML = '<p class="hint">未识别到摊位信息</p>';
      return;
    }

    container.innerHTML = parsed.map(item => {
      const productsHtml = item.products && item.products.length > 0 
        ? `<div class="preview-products">${item.products.map(p => 
            `<span class="preview-product">${this.escapeHtml(p.name)} ¥${p.price}${p.quantity > 1 ? ' ×' + p.quantity : ''}</span>`
          ).join('')}</div>`
        : '';
      const zoneHtml = item.zone ? `<span class="zone">${this.escapeHtml(item.zone)}</span>` : '';
      return `
        <div class="preview-item ${item.products?.length ? 'has-products' : ''}">
          <span class="number">${item.number}</span>
          <span class="name">${this.escapeHtml(item.name) || '(未填写)'}</span>
          ${zoneHtml}
          <span class="type">${this.getTypeLabel(item.type)}</span>
          ${productsHtml}
        </div>
      `;
    }).join('');
  }

  parseText(text) {
    const results = [];
    const seen = new Set();
    
    const labeledResult = this.parseLabeledFormat(text);
    if (labeledResult) {
      return [labeledResult];
    }
    
    const lines = text.split(/\n/);

    const doujinPattern = /([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+[A-Za-z]-?\d+)/g;
    const enterprisePattern = /(CP[A-Za-z]\d+)/gi;
    const creativePattern = /(创\d+)/g;

    let currentBooth = null;

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      let match;
      let foundBoothInLine = false;
      
      doujinPattern.lastIndex = 0;
      while ((match = doujinPattern.exec(line)) !== null) {
        const number = match[1];
        if (seen.has(number)) {
          currentBooth = results.find(r => r.number === number);
          foundBoothInLine = true;
          continue;
        }
        seen.add(number);
        
        const afterNumber = line.substring(match.index + number.length);
        const nameMatch = afterNumber.match(/[\s\-:：]+([^\s\d\-:：¥￥][^\n]*?)(?=\s{2,}|$|[，。,]|[¥￥]\d)/);
        let name = nameMatch ? nameMatch[1].trim() : '';
        
        if (!name) {
          const simpleMatch = afterNumber.match(/[\s\-:：]*([^\s¥￥]+)/);
          name = simpleMatch ? simpleMatch[1] : '';
        }
        
        name = name.replace(/[，。,\.；;】\]）\)]+$/, '').trim();
        
        currentBooth = {
          type: 'doujin',
          number: number,
          name: name,
          zone: '',
          products: []
        };
        results.push(currentBooth);
        foundBoothInLine = true;

        this.parseProductsFromLine(afterNumber, currentBooth);
      }

      if (!foundBoothInLine) {
        enterprisePattern.lastIndex = 0;
        while ((match = enterprisePattern.exec(line)) !== null) {
          const number = match[1].toUpperCase();
          if (seen.has(number)) {
            currentBooth = results.find(r => r.number === number);
            foundBoothInLine = true;
            continue;
          }
          
          const beforeChar = line[match.index - 1];
          if (beforeChar && /[壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]/.test(beforeChar)) continue;
          
          seen.add(number);
          
          const afterNumber = line.substring(match.index + number.length);
          const nameMatch = afterNumber.match(/[\s\-:：]+([^\s¥￥][^\n]*?)(?=\s{2,}|$|[，。,]|[¥￥]\d)/);
          let name = nameMatch ? nameMatch[1].trim() : '';
          
          if (!name) {
            const simpleMatch = afterNumber.match(/[\s\-:：]*([^\s¥￥]+)/);
            name = simpleMatch ? simpleMatch[1] : '';
          }
          
          name = name.replace(/[，。,\.；;】\]）\)]+$/, '').trim();
          
          currentBooth = {
            type: 'enterprise',
            number: number,
            name: name,
            zone: '',
            products: []
          };
          results.push(currentBooth);
          foundBoothInLine = true;

          this.parseProductsFromLine(afterNumber, currentBooth);
        }
      }

      if (!foundBoothInLine) {
        creativePattern.lastIndex = 0;
        while ((match = creativePattern.exec(line)) !== null) {
          const number = match[1];
          if (seen.has('c' + number)) {
            currentBooth = results.find(r => r.number === number && r.type === 'creative');
            foundBoothInLine = true;
            continue;
          }
          seen.add('c' + number);
          
          const afterNumber = line.substring(match.index + match[0].length);
          const nameMatch = afterNumber.match(/[\s\-:：]+([^\s¥￥][^\n]*?)(?=\s{2,}|$|[，。,]|[¥￥]\d)/);
          let name = nameMatch ? nameMatch[1].trim() : '';
          
          if (!name) {
            const simpleMatch = afterNumber.match(/[\s\-:：]*([^\s¥￥]+)/);
            name = simpleMatch ? simpleMatch[1] : '';
          }
          
          name = name.replace(/[，。,\.；;】\]）\)]+$/, '').trim();
          
          currentBooth = {
            type: 'creative',
            number: number,
            name: name,
            zone: '',
            products: []
          };
          results.push(currentBooth);
          foundBoothInLine = true;

          this.parseProductsFromLine(afterNumber, currentBooth);
        }
      }

      if (!foundBoothInLine && currentBooth) {
        this.parseProductsFromLine(line, currentBooth);
      }
    });

    return results;
  }

  parseLabeledFormat(text) {
    const labels = {
      number: /【摊位号】\s*([^\n【]+)/,
      name: /【摊位名】\s*([^\n【]+)/,
      zone: /【专区[\/IP]*】\s*([^\n【]+)|【IP】\s*([^\n【]+)/,
      cn: /【CN】\s*([^\n【]+)/,
      productName: /【制品名[称]?】\s*([^\n【]+)/,
      productPrice: /【制品?价格】\s*([^\n【]+)|【单价】\s*([^\n【]+)/,
      quantity: /【数量】\s*([^\n【]+)/,
    };

    const numberMatch = text.match(labels.number);
    if (!numberMatch) return null;

    const number = numberMatch[1].trim();
    const { number: extractedNumber } = this.extractBoothNumber(number);
    if (!extractedNumber) return null;

    const type = this.inferBoothType(extractedNumber);

    const nameMatch = text.match(labels.name);
    const zoneMatch = text.match(labels.zone);
    const cnMatch = text.match(labels.cn);

    let name = '';
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else if (cnMatch) {
      name = cnMatch[1].trim();
    }

    let zone = '';
    if (zoneMatch) {
      zone = (zoneMatch[1] || zoneMatch[2] || '').trim();
    }

    const products = [];
    const productBlocks = text.split(/(?=【制品名)/);
    
    productBlocks.forEach(block => {
      const pNameMatch = block.match(labels.productName);
      if (!pNameMatch) return;

      const pName = pNameMatch[1].trim();
      const pPriceMatch = block.match(labels.productPrice);
      const pQtyMatch = block.match(labels.quantity);

      let price = 0;
      if (pPriceMatch) {
        const priceStr = (pPriceMatch[1] || pPriceMatch[2] || '').trim();
        const priceNum = priceStr.match(/(\d+(?:\.\d+)?)/);
        if (priceNum) price = parseFloat(priceNum[1]);
      }

      let quantity = 1;
      if (pQtyMatch) {
        const qtyNum = pQtyMatch[1].match(/(\d+)/);
        if (qtyNum) quantity = parseInt(qtyNum[1]);
      }

      if (pName) {
        products.push({
          name: pName,
          price: price,
          quantity: quantity,
          status: 'pending'
        });
      }
    });

    return {
      type,
      number: extractedNumber,
      name,
      zone: type === 'doujin' ? zone : '',
      products
    };
  }

  parseProductsFromLine(line, booth) {
    if (!booth || !line) return;

    const productPatterns = [
      /([^\s¥￥\d][^\s¥￥]*?)\s*[¥￥]\s*(\d+(?:\.\d+)?)\s*(?:[元块]?)(?:\s*[xX×*]\s*(\d+))?/g,
      /([^\s¥￥\d][^\s¥￥]*?)\s+(\d+(?:\.\d+)?)\s*[元块]\s*(?:[xX×*]\s*(\d+))?/g,
      /[¥￥]\s*(\d+(?:\.\d+)?)\s*(?:[元块]?)\s*[xX×*]?\s*(\d+)?\s+([^\s\d][^\n]+)/g
    ];

    let foundProducts = false;

    const pattern1 = /([^\s¥￥,，\d][^\s¥￥,，]*?)\s*[¥￥]\s*(\d+(?:\.\d+)?)\s*(?:[元块]?)(?:\s*[xX×*]\s*(\d+))?/g;
    let match;
    while ((match = pattern1.exec(line)) !== null) {
      const productName = match[1].trim();
      const price = parseFloat(match[2]) || 0;
      const qty = parseInt(match[3]) || 1;
      
      if (productName && productName.length < 50 && price > 0) {
        booth.products.push({ name: productName, price, quantity: qty });
        foundProducts = true;
      }
    }

    if (!foundProducts) {
      const pattern2 = /([^\s,，\d][^\s,，]*?)\s+(\d+(?:\.\d+)?)\s*[元块]/g;
      while ((match = pattern2.exec(line)) !== null) {
        const productName = match[1].trim();
        const price = parseFloat(match[2]) || 0;
        
        if (productName && productName.length < 50 && price > 0) {
          booth.products.push({ name: productName, price, quantity: 1 });
        }
      }
    }
  }

  handleTextImport() {
    const text = document.getElementById('textImportInput').value;
    const parsed = this.parseText(text);

    if (parsed.length === 0) {
      this.showToast('未识别到有效摊位信息');
      return;
    }

    let totalProducts = 0;
    parsed.forEach(item => {
      const booth = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: item.type,
        number: item.number,
        name: item.name,
        zone: item.zone || '',
        note: '',
        images: [],
        products: item.products || [],
        pinned: false,
        createdAt: Date.now()
      };
      totalProducts += booth.products.length;
      this.booths.push(booth);
    });

    this.saveData();
    this.closeAllModals();
    this.render();
    if (totalProducts > 0) {
      this.showToast(`成功导入 ${parsed.length} 个摊位，${totalProducts} 件制品`);
    } else {
      this.showToast(`成功导入 ${parsed.length} 个摊位`);
    }
    document.getElementById('textImportInput').value = '';
  }

  async handleExcelImport(file) {
    if (!file) return;

    try {
      const rawData = await this.readExcelFile(file);
      if (!rawData || rawData.length < 2) {
        this.showToast('文件为空');
        document.getElementById('excelInput').value = '';
        return;
      }

      // === 智能解析 Excel（与小程序 parser.js 一致） ===

      const HEADER_KEYWORDS = {
        number: ['摊位号', '编号', '摊号', '展位号', '位置', '摊位编号', '展位', '社团摊位号', 'booth', 'number', 'no', 'id'],
        name: ['摊位名称', '摊位名', '社团名称', '社团名', '名称', '摊名', '社团', '店名', '名字', 'name', 'booth name', 'circle'],
        zone: ['专区', 'IP', 'ip', '所属', '分区', '区域', '作品', '同人', 'fandom', 'zone', 'area', 'category'],
        type: ['类型', '场馆', '馆', '摊位类型', 'type'],
        note: ['备注', '说明', '注释', '想买', '备忘', 'note', 'memo', 'remark'],
        product: ['制品', '制品名', '制品名称', '展品名称', '展品名', '展品', '商品', '商品名', '物品', '货品', '产品', 'product', 'item', 'goods'],
        price: ['价格', '单价', '售价', '金额', 'price', 'cost'],
        qty: ['数量', '个数', '件数', '购买数量', 'quantity', 'qty', 'count', 'amount']
      };

      const matchKW = (text, keywords) => {
        if (!text) return false;
        const lower = String(text).toLowerCase().trim();
        if (!lower) return false;
        return keywords.some(kw => {
          const lk = kw.toLowerCase();
          return lower === lk || lower.includes(lk) || lk.includes(lower);
        });
      };

      const isHeaderRow = (row) => {
        if (!Array.isArray(row)) return false;
        let matched = 0;
        const fields = Object.keys(HEADER_KEYWORDS);
        const seen = new Set();
        for (const cell of row) {
          if (!cell) continue;
          for (const field of fields) {
            if (seen.has(field)) continue;
            if (matchKW(cell, HEADER_KEYWORDS[field])) {
              seen.add(field);
              matched++;
              if (matched >= 2) return true;
            }
          }
        }
        return false;
      };

      const buildColumnMap = (headerRow) => {
        const map = {};
        const fields = Object.keys(HEADER_KEYWORDS);
        const usedCols = new Set();

        // 第一遍：精确匹配（cell === keyword）
        headerRow.forEach((cell, colIdx) => {
          if (!cell) return;
          const lower = String(cell).toLowerCase().trim();
          if (!lower) return;
          for (const field of fields) {
            if (map[field] !== undefined) continue;
            const exact = HEADER_KEYWORDS[field].some(kw => lower === kw.toLowerCase());
            if (exact) {
              map[field] = colIdx;
              usedCols.add(colIdx);
              break;
            }
          }
        });

        // 第二遍：模糊匹配（includes），跳过已分配的列和字段
        headerRow.forEach((cell, colIdx) => {
          if (!cell || usedCols.has(colIdx)) return;
          for (const field of fields) {
            if (map[field] !== undefined) continue;
            if (matchKW(cell, HEADER_KEYWORDS[field])) {
              map[field] = colIdx;
              usedCols.add(colIdx);
              break;
            }
          }
        });

        return map;
      };

      const inferColumnMap = (dataRows) => {
        if (!dataRows.length) return {};
        const colCount = Math.max(...dataRows.map(r => (r ? r.length : 0)));
        if (colCount === 0) return {};
        const stats = Array.from({ length: colCount }, () => ({ boothHits: 0, priceHits: 0, textHits: 0, total: 0 }));
        const sampleRows = dataRows.slice(0, Math.min(50, dataRows.length));
        sampleRows.forEach(row => {
          if (!Array.isArray(row)) return;
          row.forEach((cell, ci) => {
            if (ci >= colCount) return;
            const s = stats[ci];
            const val = String(cell || '').trim();
            if (!val) return;
            s.total++;
            s.textHits++;
            const { number } = this.extractBoothNumber(val);
            if (number) s.boothHits++;
            if (/^\d+(\.\d+)?$/.test(val)) s.priceHits++;
          });
        });

        const map = {};
        let bestBoothCol = -1, bestBoothRate = 0;
        stats.forEach((s, ci) => {
          if (s.total === 0) return;
          const rate = s.boothHits / s.total;
          if (rate > 0.4 && rate > bestBoothRate) { bestBoothRate = rate; bestBoothCol = ci; }
        });
        if (bestBoothCol >= 0) map.number = bestBoothCol;

        let bestPriceCol = -1, bestPriceRate = 0;
        stats.forEach((s, ci) => {
          if (ci === map.number || s.total === 0) return;
          const rate = s.priceHits / s.total;
          if (rate > 0.6 && rate > bestPriceRate) { bestPriceRate = rate; bestPriceCol = ci; }
        });
        if (bestPriceCol >= 0) map.price = bestPriceCol;

        const remaining = [];
        stats.forEach((s, ci) => {
          if (ci === map.number || ci === map.price) return;
          if (s.textHits > 0) remaining.push(ci);
        });
        if (remaining.length >= 1) map.product = remaining[0];
        if (remaining.length >= 2) map.name = remaining[1];
        if (remaining.length >= 3) map.note = remaining[2];
        return map;
      };

      const getCell = (row, colMap, field) => {
        if (colMap[field] === undefined) return '';
        const val = row[colMap[field]];
        if (val === undefined || val === null) return '';
        return String(val).trim();
      };

      const isJunkRow = (row, colMap) => {
        if (!Array.isArray(row)) return true;
        const numberVal = getCell(row, colMap, 'number');
        const productVal = getCell(row, colMap, 'product');
        const firstCell = String(row[0] || '').trim();
        if (/^(COMICUP|CP\d|共\d|合计|总计|统计)/i.test(firstCell)) return true;
        if (!numberVal && !productVal) return true;
        return false;
      };

      // Phase 1: 定位表头行
      let headerRowIdx = -1;
      let colMap = {};
      const scanLimit = Math.min(10, rawData.length);
      for (let i = 0; i < scanLimit; i++) {
        if (isHeaderRow(rawData[i])) {
          headerRowIdx = i;
          colMap = buildColumnMap(rawData[i]);
          break;
        }
      }

      let dataRows;
      if (headerRowIdx >= 0) {
        dataRows = rawData.slice(headerRowIdx + 1);
      } else {
        let startIdx = 0;
        let foundStart = false;
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (!Array.isArray(row)) continue;
          for (const cell of row) {
            const { number } = this.extractBoothNumber(cell);
            if (number) { startIdx = i; foundStart = true; break; }
          }
          if (foundStart) break;
        }
        dataRows = rawData.slice(startIdx);
        colMap = inferColumnMap(dataRows);
      }

      if (colMap.number === undefined && colMap.product === undefined) {
        this.showToast('未识别到有效数据');
        document.getElementById('excelInput').value = '';
        return;
      }

      // Phase 2: 逐行解析 + 同摊位号合并
      const boothMap = new Map();
      let lastBooth = null;
      let lastZone = '';

      dataRows.forEach(row => {
        if (!Array.isArray(row)) return;
        if (isJunkRow(row, colMap)) return;

        const numberRaw = getCell(row, colMap, 'number');
        const nameRaw = getCell(row, colMap, 'name');
        const zoneRaw = getCell(row, colMap, 'zone');
        const noteRaw = getCell(row, colMap, 'note');
        const productRaw = getCell(row, colMap, 'product');
        const priceRaw = getCell(row, colMap, 'price');
        const qtyRaw = getCell(row, colMap, 'qty');

        if (zoneRaw) lastZone = zoneRaw;

        const { number: extractedNumber } = this.extractBoothNumber(numberRaw);

        if (extractedNumber && boothMap.has(extractedNumber)) {
          lastBooth = boothMap.get(extractedNumber);
          if (nameRaw && (!lastBooth.name || lastBooth.name === '未命名')) {
            lastBooth.name = nameRaw;
          }
        } else if (extractedNumber) {
          const type = this.inferBoothType(extractedNumber);
          lastBooth = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            number: extractedNumber,
            name: nameRaw || '未命名',
            zone: zoneRaw || lastZone,
            note: noteRaw || '',
            images: [],
            products: [],
            pinned: false,
            createdAt: Date.now()
          };
          boothMap.set(extractedNumber, lastBooth);
        }

        if (productRaw && lastBooth) {
          const price = parseFloat(String(priceRaw).replace(/[¥￥,，]/g, '')) || 0;
          const qty = parseInt(String(qtyRaw)) || 1;
          lastBooth.products.push({
            name: productRaw,
            price,
            quantity: qty,
            status: 'pending'
          });
        }
      });

      const boothList = Array.from(boothMap.values());

      if (boothList.length > 0) {
        boothList.forEach(booth => this.booths.push(booth));
        this.saveData();
        this.render();
        const totalProducts = boothList.reduce((sum, b) => sum + b.products.length, 0);
        if (totalProducts > 0) {
          this.showToast(`成功导入 ${boothList.length} 个摊位，${totalProducts} 件制品`);
        } else {
          this.showToast(`成功导入 ${boothList.length} 个摊位`);
        }
      } else {
        this.showToast('未识别到有效数据');
      }
    } catch (e) {
      console.error('Excel import error:', e);
      this.showToast('导入失败，请检查文件格式');
    }

    document.getElementById('excelInput').value = '';
  }

  readExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          if (data.length < 1) {
            resolve([]);
            return;
          }

          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  findColumnValue(row, possibleNames) {
    for (const name of possibleNames) {
      const lowerName = name.toLowerCase();
      for (const key of Object.keys(row)) {
        if (typeof key === 'string') {
          const lowerKey = key.toLowerCase().trim();
          if (lowerKey === lowerName || lowerKey.includes(lowerName) || lowerName.includes(lowerKey)) {
            const val = row[key];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              return val;
            }
          }
        }
      }
    }
    return '';
  }

  inferBoothType(number) {
    const str = String(number);
    if (/^[壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]/.test(str)) {
      return 'doujin';
    }
    if (/^CP[A-Za-z]\d/i.test(str)) {
      return 'enterprise';
    }
    if (/^创\d/.test(str)) {
      return 'creative';
    }
    return 'doujin';
  }

  isValidBoothNumber(number) {
    if (!number) return false;
    const str = String(number).trim();
    if (str.length > 15) return false;
    if (/^[壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+[A-Za-z]-?\d+$/.test(str)) return true;
    if (/^CP[A-Za-z]\d+$/i.test(str)) return true;
    if (/^创\d+$/.test(str)) return true;
    return false;
  }

  extractBoothNumber(text) {
    if (!text) return { number: null, extra: null };
    const str = String(text).trim();
    
    const doujinMatch = str.match(/([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+[A-Za-z]-?\d+)/);
    if (doujinMatch) {
      const extra = str.replace(doujinMatch[0], '').trim();
      return { number: doujinMatch[0], extra: extra || null };
    }
    
    const enterpriseMatch = str.match(/(CP[A-Za-z]\d+)/i);
    if (enterpriseMatch) {
      const extra = str.replace(enterpriseMatch[0], '').trim();
      return { number: enterpriseMatch[0].toUpperCase(), extra: extra || null };
    }
    
    const creativeMatch = str.match(/(创\d+)/);
    if (creativeMatch) {
      const extra = str.replace(creativeMatch[0], '').trim();
      return { number: creativeMatch[0], extra: extra || null };
    }
    
    return { number: null, extra: str };
  }

  sortBooths(booths) {
    const chineseNumOrder = {
      '壹': 1, '一': 1,
      '贰': 2, '二': 2,
      '叁': 3, '三': 3,
      '肆': 4, '四': 4,
      '伍': 5, '五': 5,
      '陆': 6, '六': 6,
      '柒': 7, '七': 7,
      '捌': 8, '八': 8,
      '玖': 9, '九': 9,
      '拾': 10, '十': 10
    };

    const parseDoujinNumber = (num) => {
      const match = num.match(/^([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+)([A-Za-z])-?(\d+)$/);
      if (match) {
        let venue = 0;
        for (const char of match[1]) {
          venue = venue * 10 + (chineseNumOrder[char] || 0);
        }
        return {
          venue,
          letter: match[2].toUpperCase(),
          number: parseInt(match[3]) || 0
        };
      }
      
      const match2 = num.match(/^([A-Za-z])-?(\d+)$/);
      if (match2) {
        return {
          venue: 0,
          letter: match2[1].toUpperCase(),
          number: parseInt(match2[2]) || 0
        };
      }
      
      const match3 = num.match(/(\d+)/);
      if (match3) {
        return {
          venue: 0,
          letter: 'A',
          number: parseInt(match3[1]) || 0
        };
      }
      
      return { venue: 999, letter: 'Z', number: 999 };
    };

    const parseEnterpriseNumber = (num) => {
      const match = num.match(/^CP([A-Za-z])(\d+)$/i);
      if (match) {
        return {
          venue: match[1].toUpperCase(),
          number: parseInt(match[2]) || 0
        };
      }
      return { venue: 'Z', number: 999 };
    };

    const parseCreativeNumber = (num) => {
      const match = num.match(/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };

    const nonPinned = booths.filter(b => !b.pinned);
    
    const getVenueKey = (booth) => {
      if (booth.type === 'doujin') {
        const match = booth.number.match(/^([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+)/);
        return match ? `doujin_${match[1]}` : 'doujin_other';
      } else if (booth.type === 'enterprise') {
        const match = booth.number.match(/^CP([A-Za-z])/i);
        return match ? `enterprise_${match[1].toUpperCase()}` : 'enterprise_other';
      }
      return booth.type;
    };

    nonPinned.sort((a, b) => {
      if (a.type !== b.type) {
        const typeOrder = { doujin: 0, enterprise: 1, creative: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      }

      const venueA = getVenueKey(a);
      const venueB = getVenueKey(b);
      if (venueA !== venueB) {
        switch (a.type) {
          case 'doujin': {
            const pa = parseDoujinNumber(a.number);
            const pb = parseDoujinNumber(b.number);
            return pa.venue - pb.venue;
          }
          case 'enterprise': {
            const pa = parseEnterpriseNumber(a.number);
            const pb = parseEnterpriseNumber(b.number);
            return pa.venue.localeCompare(pb.venue);
          }
        }
        return venueA.localeCompare(venueB);
      }

      if (a.manualOrder !== undefined && b.manualOrder !== undefined) {
        return a.manualOrder - b.manualOrder;
      }
      if (a.manualOrder !== undefined) return -1;
      if (b.manualOrder !== undefined) return 1;

      switch (a.type) {
        case 'doujin': {
          const pa = parseDoujinNumber(a.number);
          const pb = parseDoujinNumber(b.number);
          if (pa.letter !== pb.letter) return pa.letter.localeCompare(pb.letter);
          return pa.number - pb.number;
        }
        case 'enterprise': {
          const pa = parseEnterpriseNumber(a.number);
          const pb = parseEnterpriseNumber(b.number);
          return pa.number - pb.number;
        }
        case 'creative': {
          return parseCreativeNumber(a.number) - parseCreativeNumber(b.number);
        }
        default:
          return 0;
      }
    });

    return nonPinned;
  }

  getVenueLabel(booth) {
    switch (booth.type) {
      case 'doujin': {
        const match = booth.number.match(/^([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+)/);
        return match ? `${match[1]}馆` : '同人馆';
      }
      case 'enterprise': {
        const match = booth.number.match(/^CP([A-Za-z])/i);
        if (match) {
          const letter = match[1].toUpperCase();
          return letter === 'A' ? '6B馆' : (letter === 'B' ? '6A馆' : `6${letter}馆`);
        }
        return '企业馆';
      }
      case 'creative':
        return '创摊';
      default:
        return '';
    }
  }

  getTypeLabel(type) {
    const labels = {
      doujin: '同人馆',
      enterprise: '企业馆',
      creative: '创摊'
    };
    return labels[type] || type;
  }

  groupByVenue(booths) {
    const groups = {};
    
    const chineseNumOrder = {
      '壹': 1, '一': 1,
      '贰': 2, '二': 2,
      '叁': 3, '三': 3,
      '肆': 4, '四': 4,
      '伍': 5, '五': 5,
      '陆': 6, '六': 6,
      '柒': 7, '七': 7,
      '捌': 8, '八': 8,
      '玖': 9, '九': 9,
      '拾': 10, '十': 10
    };

    const parseChineseNum = (str) => {
      let num = 0;
      for (const char of str) {
        num = num * 10 + (chineseNumOrder[char] || 0);
      }
      return num;
    };
    
    booths.forEach(booth => {
      let venueKey;
      let venueOrder;
      
      switch (booth.type) {
        case 'doujin': {
          const match = booth.number.match(/^([壹贰叁肆伍陆柒捌玖拾一二三四五六七八九十]+)/);
          if (match) {
            venueKey = `doujin_${match[1]}`;
            venueOrder = parseChineseNum(match[1]);
          } else {
            venueKey = 'doujin_other';
            venueOrder = 999;
          }
          break;
        }
        case 'enterprise': {
          const match = booth.number.match(/^CP([A-Za-z])/i);
          if (match) {
            const letter = match[1].toUpperCase();
            venueKey = `enterprise_${letter}`;
            venueOrder = 1000 + letter.charCodeAt(0);
          } else {
            venueKey = 'enterprise_other';
            venueOrder = 1999;
          }
          break;
        }
        case 'creative':
          venueKey = 'creative';
          venueOrder = 2000;
          break;
        default:
          venueKey = 'other';
          venueOrder = 3000;
      }

      if (!groups[venueKey]) {
        groups[venueKey] = {
          type: booth.type,
          label: this.getVenueLabel(booth),
          booths: [],
          order: venueOrder
        };
      }
      groups[venueKey].booths.push(booth);
    });

    return Object.values(groups).sort((a, b) => a.order - b.order);
  }

  render() {
    let filtered = this.booths;
    if (this.currentFilter !== 'all') {
      filtered = this.booths.filter(b => b.type === this.currentFilter);
    }

    const pinnedBooths = filtered.filter(b => b.pinned);
    const unpinnedFiltered = filtered.filter(b => !b.pinned);
    
    const sorted = this.sortBooths([...unpinnedFiltered]);
    const groups = this.groupByVenue(sorted);
    const container = document.getElementById('boothList');
    const emptyState = document.getElementById('emptyState');

    if (filtered.length === 0) {
      container.innerHTML = '';
      emptyState.classList.add('show');
      return;
    }

    emptyState.classList.remove('show');

    let html = '';
    
    if (pinnedBooths.length > 0) {
      html += `
        <div class="venue-group pinned-group">
          <div class="venue-header">
            <span class="venue-badge pinned"><i class="fas fa-thumbtack"></i> 置顶</span>
            <span>${pinnedBooths.length}个摊位</span>
          </div>
          ${pinnedBooths.map(booth => this.renderBoothCard(booth)).join('')}
        </div>
      `;
    }

    html += groups.map(group => `
      <div class="venue-group">
        <div class="venue-header">
          <span class="venue-badge ${group.type}">${group.label}</span>
          <span>${group.booths.length}个摊位</span>
        </div>
        ${group.booths.map(booth => this.renderBoothCard(booth)).join('')}
      </div>
    `).join('');

    container.innerHTML = html;

    // 事件委托已在 init 中绑定，不再需要每次 render 重新绑定
  }

  renderBoothCard(booth) {
    const total = this.calculateBoothTotal(booth);
    const productCount = booth.products?.length || 0;
    const venueLabel = this.getVenueLabel(booth);
    const isSelected = this.selectedBooths.has(booth.id);
    const boughtCount = booth.products?.filter(p => p.status === 'bought').length || 0;
    const isExpanded = this.expandedBooths?.has(booth.id);

    let productsHtml = '';
    if (booth.products && booth.products.length > 0) {
      productsHtml = booth.products.map((p, idx) => {
        const statusClass = p.status === 'bought' ? 'bought' : (p.status === 'missed' ? 'missed' : '');
        const statusIcon = p.status === 'bought' ? '✓' : (p.status === 'missed' ? '✗' : '○');
        return `
          <div class="expand-product-row ${statusClass}" data-booth="${booth.id}" data-idx="${idx}">
            <span class="product-status-icon" onclick="event.stopPropagation(); app.cycleProductStatus('${booth.id}', ${idx})">${statusIcon}</span>
            <span class="product-name">${this.escapeHtml(p.name || '')}</span>
            <span class="product-price">¥${(p.price || 0).toFixed(0)}</span>
            <span class="product-qty">×${p.quantity || 1}</span>
          </div>
          ${p.status === 'missed' && p.statusNote ? `<div class="expand-product-note">${this.escapeHtml(p.statusNote)}</div>` : ''}
        `;
      }).join('');
    }

    let noteHtml = '';
    if (booth.note) {
      noteHtml = `<div class="expand-note"><i class="fas fa-sticky-note"></i> ${this.escapeHtml(booth.note)}</div>`;
    }

    let imagesHtml = '';
    if (booth.images && booth.images.length > 0) {
      imagesHtml = `
        <div class="expand-images">
          ${booth.images.map(img => `<img src="${img}" onclick="event.stopPropagation(); app.viewImage('${img}')">`).join('')}
        </div>
      `;
    }

    return `
      <div class="booth-card ${booth.pinned ? 'pinned' : ''} ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" data-id="${booth.id}">
        <div class="booth-card-inner">
          <div class="batch-checkbox"></div>
          <div class="booth-number ${booth.type}">
            <span class="number">${booth.number}</span>
            <span class="venue">${venueLabel}</span>
          </div>
          <div class="booth-info">
            <div class="booth-name">${this.escapeHtml(booth.name)}</div>
            <div class="booth-zone">${booth.type === 'doujin' && booth.zone ? this.escapeHtml(booth.zone) : ''}</div>
          </div>
          <div class="booth-right">
            ${total > 0 ? `
              <div class="booth-total">
                <div class="amount">¥${total.toFixed(0)}</div>
                <div class="count">${boughtCount}/${productCount}</div>
              </div>
            ` : ''}
            <div class="booth-expand-icon">
              <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'}"></i>
            </div>
          </div>
        </div>
        <div class="booth-expand-content">
          ${noteHtml}
          ${imagesHtml}
          ${productsHtml}
          ${booth.products && booth.products.length > 0 ? `
            <div class="expand-total">
              <span>合计</span>
              <span class="expand-total-amount">¥${total.toFixed(2)}</span>
            </div>
          ` : (noteHtml || imagesHtml ? '' : '<div class="expand-empty">暂无制品</div>')}
          <div class="expand-actions">
            <button class="btn btn-sm ${booth.pinned ? 'btn-warning' : 'btn-outline'}" onclick="event.stopPropagation(); app.togglePin('${booth.id}')">
              <i class="fas fa-thumbtack"></i> ${booth.pinned ? '取消置顶' : '置顶'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.openEditModal('${booth.id}')">
              <i class="fas fa-edit"></i> 编辑
            </button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); app.deleteBooth('${booth.id}')">
              <i class="fas fa-trash"></i> 删除
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async cycleProductStatus(boothId, productIdx) {
    const booth = this.booths.find(b => b.id === boothId);
    if (!booth || !booth.products[productIdx]) return;

    const product = booth.products[productIdx];
    const statusOrder = ['pending', 'bought', 'missed'];
    const currentIdx = statusOrder.indexOf(product.status || 'pending');
    product.status = statusOrder[(currentIdx + 1) % statusOrder.length];
    
    if (product.status === 'missed' && !product.statusNote) {
      const note = await this.showPrompt('未买到原因（可选）', '请输入原因...');
      if (note) product.statusNote = note;
    }
    
    this.saveData();
    this.render();
  }

  toggleBoothExpand(boothId) {
    if (!this.expandedBooths) this.expandedBooths = new Set();
    
    const card = document.querySelector(`.booth-card[data-id="${boothId}"]`);
    if (!card) return;

    if (this.expandedBooths.has(boothId)) {
      this.expandedBooths.delete(boothId);
      card.classList.remove('expanded');
      // 更新箭头方向
      const icon = card.querySelector('.booth-expand-icon i');
      if (icon) { icon.className = 'fas fa-chevron-down'; }
    } else {
      this.expandedBooths.add(boothId);
      card.classList.add('expanded');
      const icon = card.querySelector('.booth-expand-icon i');
      if (icon) { icon.className = 'fas fa-chevron-up'; }
    }
    // 不再调用 this.render()，避免 DOM 重建导致触屏事件状态丢失
  }

  // 旧方法保留空壳，防止其他地方调用报错
  bindCardEvents() {}

  // 事件委托版本 — 只绑定一次到容器，不随 render 重建
  bindCardEventsDelegated() {
    const container = document.getElementById('boothList');
    if (!container) return;
    const st = this._cardTouchState;

    const findCard = (target) => {
      const inner = target.closest('.booth-card-inner');
      if (!inner) return null;
      const card = inner.closest('.booth-card');
      return card ? { card, inner } : null;
    };

    const handleStart = (e) => {
      const hit = findCard(e.target);
      if (!hit) return;

      if (e.type === 'mousedown' && st.isTouchActive) return;
      if (e.type === 'touchstart') st.isTouchActive = true;

      const touch = e.touches ? e.touches[0] : e;
      st.startY = touch.clientY;
      st.startX = touch.clientX;
      st.isScrolling = false;
      st.isDragging = false;
      st.activeCard = hit.card;

      clearTimeout(st.longPressTimer);
      st.longPressTimer = setTimeout(() => {
        st.isDragging = true;
        this.startDrag(hit.card, touch.clientY);
      }, 500);
    };

    const handleMove = (e) => {
      if (!st.activeCard) return;
      const touch = e.touches ? e.touches[0] : e;
      const deltaY = Math.abs(touch.clientY - st.startY);
      const deltaX = Math.abs(touch.clientX - st.startX);

      if (deltaY > 30 || deltaX > 30) {
        if (!st.isDragging) {
          st.isScrolling = true;
          clearTimeout(st.longPressTimer);
        }
      }

      if (st.isDragging && this.dragState.active) {
        e.preventDefault();
        this.handleDrag(touch.clientY);
      }
    };

    const handleEnd = (e) => {
      if (!st.activeCard) return;
      if (e.type === 'mouseup' && st.isTouchActive) return;

      clearTimeout(st.longPressTimer);

      if (st.isDragging && this.dragState.active) {
        this.endDrag();
        st.activeCard = null;
        return;
      }

      if (!st.isScrolling) {

        const boothId = st.activeCard.dataset.id;
        if (this.batchMode) {
          this.toggleBoothSelection(boothId);
        } else {
          this.toggleBoothExpand(boothId);
        }
      }

      st.activeCard = null;

      if (e.type === 'touchend') {
        setTimeout(() => { st.isTouchActive = false; }, 400);
      }
    };

    const handleLeave = () => {
      clearTimeout(st.longPressTimer);
      if (st.isDragging && this.dragState.active) {
        this.endDrag();
      }
      st.activeCard = null;
    };

    container.addEventListener('touchstart', handleStart, { passive: true });
    container.addEventListener('touchmove', handleMove, { passive: false });
    container.addEventListener('touchend', handleEnd);
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseup', handleEnd);
    container.addEventListener('mouseleave', handleLeave);
  }

  startDrag(card, startY) {
    this.dragState = {
      active: true,
      startY,
      currentCard: card,
      startIndex: Array.from(card.parentElement.children).indexOf(card)
    };
    card.classList.add('dragging');
    navigator.vibrate && navigator.vibrate(50);
  }

  handleDrag(currentY) {
    const { currentCard } = this.dragState;
    if (!currentCard) return;

    const cards = Array.from(currentCard.parentElement.querySelectorAll('.booth-card:not(.dragging)'));
    const cardRect = currentCard.getBoundingClientRect();

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (currentY > rect.top && currentY < rect.bottom) {
        if (currentY < cardRect.top) {
          card.parentElement.insertBefore(currentCard, card);
        } else {
          card.parentElement.insertBefore(currentCard, card.nextSibling);
        }
      }
    });
  }

  endDrag() {
    const { currentCard } = this.dragState;
    if (currentCard) {
      currentCard.classList.remove('dragging');
      
      const container = currentCard.parentElement;
      if (container) {
        const cardsInGroup = container.querySelectorAll('.booth-card');
        cardsInGroup.forEach((card, index) => {
          const booth = this.booths.find(b => b.id === card.dataset.id);
          if (booth) {
            booth.manualOrder = index;
          }
        });
        this.saveData();
        this.showToast('顺序已保存');
      }
    }
    this.dragState = { active: false, startY: 0, currentCard: null };
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  showConfirm(message, title = '确认') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmMessage');
      const titleEl = document.getElementById('confirmTitle');
      const okBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');
      const inputWrap = document.getElementById('confirmInputWrap');
      const overlay = modal.querySelector('.modal-overlay');
      const closeBtn = modal.querySelector('.btn-close');

      titleEl.textContent = title;
      msgEl.textContent = message;
      inputWrap.style.display = 'none';
      okBtn.textContent = '确定';
      okBtn.className = 'btn btn-danger';
      modal.classList.add('active');

      const cleanup = () => {
        modal.classList.remove('active');
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        overlay.replaceWith(overlay.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
      };

      okBtn.addEventListener('click', () => { cleanup(); resolve(true); }, { once: true });
      cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
      overlay.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
      closeBtn.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
    });
  }

  showPrompt(message, placeholder = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmMessage');
      const titleEl = document.getElementById('confirmTitle');
      const okBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');
      const inputWrap = document.getElementById('confirmInputWrap');
      const input = document.getElementById('confirmInput');
      const overlay = modal.querySelector('.modal-overlay');
      const closeBtn = modal.querySelector('.btn-close');

      titleEl.textContent = '输入';
      msgEl.textContent = message;
      inputWrap.style.display = 'block';
      input.value = '';
      input.placeholder = placeholder;
      okBtn.textContent = '确定';
      okBtn.className = 'btn btn-primary';
      modal.classList.add('active');
      setTimeout(() => input.focus(), 100);

      const cleanup = () => {
        modal.classList.remove('active');
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        overlay.replaceWith(overlay.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
      };

      okBtn.addEventListener('click', () => { cleanup(); resolve(input.value); }, { once: true });
      cancelBtn.addEventListener('click', () => { cleanup(); resolve(null); }, { once: true });
      overlay.addEventListener('click', () => { cleanup(); resolve(null); }, { once: true });
      closeBtn.addEventListener('click', () => { cleanup(); resolve(null); }, { once: true });
    });
  }
}

const app = new CPShoppingList();
