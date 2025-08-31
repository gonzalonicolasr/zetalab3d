/* ==============================
   ZETALAB Admin Pieces Management
   Complete pieces management interface
============================== */

class AdminPieces {
  constructor() {
    this.pieces = [];
    this.filteredPieces = [];
    this.currentPage = 1;
    this.pageSize = ADMIN_CONFIG.USERS_PER_PAGE;
    this.totalPages = 1;
    this.filters = {
      search: '',
      category: ''
    };
    
    this.searchDebounce = AdminUtils.debounce(this.applyFilters.bind(this), 300);
  }

  async init() {
    console.log('Initializing Admin Pieces Management...');
    
    // Bind events
    this.bindEvents();
    
    // Load pieces data
    await this.loadPieces();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('pieceSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.searchDebounce();
      });
    }

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.applyFilters();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshPieces');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadPieces();
      });
    }

    // Export button
    const exportBtn = document.getElementById('exportPieces');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportPieces();
      });
    }

    // Pagination
    const prevBtn = document.getElementById('piecesPrevPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderPieces();
        }
      });
    }

    const nextBtn = document.getElementById('piecesNextPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.renderPieces();
        }
      });
    }
  }

  async loadPieces() {
    try {
      AdminUtils.showLoading();

      // Load pieces from database
      const { data: pieces, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select(`
          id, title, description, category, est_price_ars, 
          user_id, created_at, updated_at, makerworld_url
        `)
        .order('created_at', { ascending: false });

      if (piecesError) {
        console.error('Error loading pieces:', piecesError);
        throw piecesError;
      }

      // Load piece versions for each piece
      const pieceVersionsPromises = (pieces || []).map(async (piece) => {
        const { data: versions, error: versionsError } = await supabaseAdmin
          .from('piece_versions')
          .select('id, created_at, total, ml_price')
          .eq('piece_id', piece.id)
          .order('created_at', { ascending: false });

        if (!versionsError && versions) {
          piece.versions = versions;
          piece.versionCount = versions.length;
          piece.latestVersion = versions[0] || null;
          piece.totalCalculations = versions.length;
        } else {
          piece.versions = [];
          piece.versionCount = 0;
          piece.latestVersion = null;
          piece.totalCalculations = 0;
        }

        return piece;
      });

      this.pieces = await Promise.all(pieceVersionsPromises);

      // Update stats
      this.updatePiecesStats();

      // Apply current filters
      this.applyFilters();
      
      AdminUtils.showToast('Piezas cargadas correctamente', 'success');

      // Log admin activity
      await AdminUtils.logAdminActivity('view_pieces', 'pieces', null, {
        piece_count: this.pieces.length
      });

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading pieces');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  updatePiecesStats() {
    const stats = {
      totalPieces: this.pieces.length,
      totalVersions: this.pieces.reduce((sum, piece) => sum + piece.versionCount, 0),
      avgVersionsPerPiece: this.pieces.length > 0 ? 
        (this.pieces.reduce((sum, piece) => sum + piece.versionCount, 0) / this.pieces.length).toFixed(1) : 0,
      totalEstimatedValue: this.pieces.reduce((sum, piece) => 
        sum + (parseFloat(piece.est_price_ars) || 0), 0)
    };

    // Update UI
    document.getElementById('totalPiecesCount').textContent = AdminUtils.formatNumber(stats.totalPieces);
    document.getElementById('totalVersionsCount').textContent = AdminUtils.formatNumber(stats.totalVersions);
    document.getElementById('avgVersionsPerPiece').textContent = stats.avgVersionsPerPiece;
    document.getElementById('totalEstimatedValue').textContent = AdminUtils.formatCurrency(stats.totalEstimatedValue);
  }

  applyFilters() {
    let filtered = [...this.pieces];

    // Apply search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(piece => 
        (piece.title && piece.title.toLowerCase().includes(searchTerm)) ||
        (piece.description && piece.description.toLowerCase().includes(searchTerm)) ||
        (piece.id && piece.id.toLowerCase().includes(searchTerm)) ||
        (piece.user_id && piece.user_id.toLowerCase().includes(searchTerm))
      );
    }

    // Apply category filter
    if (this.filters.category) {
      filtered = filtered.filter(piece => piece.category === this.filters.category);
    }

    this.filteredPieces = filtered;
    this.currentPage = 1;
    this.renderPieces();
  }

  renderPieces() {
    const tbody = document.getElementById('piecesTableBody');
    if (!tbody) return;

    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredPieces.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredPieces.length);
    const pagePieces = this.filteredPieces.slice(startIndex, endIndex);

    // Render pieces table
    if (pagePieces.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 2rem;">
            No se encontraron piezas con los filtros aplicados
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pagePieces.map(piece => this.renderPieceRow(piece)).join('');
    }

    // Update pagination info
    this.updatePaginationInfo();
  }

  renderPieceRow(piece) {
    const categoryIcon = this.getCategoryIcon(piece.category);
    const categoryText = this.getCategoryText(piece.category);
    
    return `
      <tr class="fade-in">
        <td>
          <div class="piece-info">
            <div class="piece-title">
              ${piece.title || 'Sin título'}
              ${piece.makerworld_url ? '🔗' : ''}
            </div>
            <div class="piece-id" title="${piece.id}">
              ID: ${piece.id.substring(0, 8)}...
            </div>
            ${piece.description ? `
              <div class="piece-description" title="${piece.description}">
                ${piece.description.substring(0, 50)}${piece.description.length > 50 ? '...' : ''}
              </div>
            ` : ''}
          </div>
        </td>
        <td>
          <div class="user-info">
            <div class="user-id" title="${piece.user_id}">
              ${piece.user_id.substring(0, 8)}...
            </div>
          </div>
        </td>
        <td>
          <div class="category-info">
            <span class="category-badge">
              ${categoryIcon} ${categoryText}
            </span>
          </div>
        </td>
        <td>
          <div class="price-info">
            <div class="estimated-price">
              ${AdminUtils.formatCurrency(piece.est_price_ars || 0)}
            </div>
            ${piece.latestVersion && piece.latestVersion.total ? `
              <div class="latest-calculation">
                Último: ${AdminUtils.formatCurrency(piece.latestVersion.total)}
              </div>
            ` : ''}
          </div>
        </td>
        <td class="text-center">
          <div class="versions-info">
            <span class="version-count">${piece.versionCount}</span>
            <div class="version-detail">versiones</div>
          </div>
        </td>
        <td>
          <div class="date-info">
            <div class="date-main">${AdminUtils.formatDate(piece.created_at)}</div>
            <div class="date-relative">${AdminUtils.getRelativeTime(piece.created_at)}</div>
          </div>
        </td>
        <td>
          <div class="last-version-info">
            ${piece.latestVersion ? `
              <div class="date-main">${AdminUtils.formatDate(piece.latestVersion.created_at)}</div>
              <div class="date-relative">${AdminUtils.getRelativeTime(piece.latestVersion.created_at)}</div>
            ` : '<span class="no-versions">Sin versiones</span>'}
          </div>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn primary" onclick="adminPieces.viewPieceDetail('${piece.id}')" 
                    title="Ver detalles de la pieza">
              👁️ Ver
            </button>
            <button class="action-btn info" onclick="adminPieces.viewPieceVersions('${piece.id}')" 
                    title="Ver historial de versiones">
              📊 Versiones
            </button>
            ${piece.makerworld_url ? `
              <button class="action-btn secondary" onclick="window.open('${piece.makerworld_url}', '_blank')" 
                      title="Ver en MakerWorld">
                🔗 MW
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  getCategoryIcon(category) {
    const iconMap = {
      'functional': '🔧',
      'decorative': '🎨',
      'prototype': '🧪',
      'art': '🖼️',
      'toy': '🧸',
      'tool': '🛠️',
      'household': '🏠',
      'automotive': '🚗',
      'electronics': '⚡',
      'jewelry': '💎'
    };
    return iconMap[category] || '📦';
  }

  getCategoryText(category) {
    const textMap = {
      'functional': 'Funcional',
      'decorative': 'Decorativo',
      'prototype': 'Prototipo',
      'art': 'Arte',
      'toy': 'Juguete',
      'tool': 'Herramienta',
      'household': 'Hogar',
      'automotive': 'Automotriz',
      'electronics': 'Electrónica',
      'jewelry': 'Joyería'
    };
    return textMap[category] || (category || 'Sin categoría');
  }

  updatePaginationInfo() {
    const pageInfo = document.getElementById('piecesPageInfo');
    if (pageInfo) {
      pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
    }

    const prevBtn = document.getElementById('piecesPrevPage');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }

    const nextBtn = document.getElementById('piecesNextPage');
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= this.totalPages;
    }
  }

  async viewPieceDetail(pieceId) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece) {
      AdminUtils.showToast('Pieza no encontrada', 'error');
      return;
    }

    // Create and show piece detail modal
    const modal = this.createPieceDetailModal(piece);
    document.body.appendChild(modal);
    modal.classList.add('active');
  }

  createPieceDetailModal(piece) {
    const modal = document.createElement('div');
    modal.className = 'modal piece-detail-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content large">
        <div class="modal-header">
          <h3>🔧 ${piece.title || 'Pieza sin título'}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="piece-detail-grid">
            <div class="piece-info-section">
              <h4>Información General</h4>
              <div class="info-grid">
                <div class="info-item">
                  <label>ID:</label>
                  <span>${piece.id}</span>
                </div>
                <div class="info-item">
                  <label>Título:</label>
                  <span>${piece.title || 'Sin título'}</span>
                </div>
                <div class="info-item">
                  <label>Categoría:</label>
                  <span>${this.getCategoryIcon(piece.category)} ${this.getCategoryText(piece.category)}</span>
                </div>
                <div class="info-item">
                  <label>Precio Estimado:</label>
                  <span>${AdminUtils.formatCurrency(piece.est_price_ars || 0)}</span>
                </div>
                <div class="info-item">
                  <label>Usuario:</label>
                  <span>${piece.user_id}</span>
                </div>
                <div class="info-item">
                  <label>Creada:</label>
                  <span>${AdminUtils.formatDateTime(piece.created_at)}</span>
                </div>
                <div class="info-item">
                  <label>Actualizada:</label>
                  <span>${AdminUtils.formatDateTime(piece.updated_at)}</span>
                </div>
                ${piece.makerworld_url ? `
                  <div class="info-item">
                    <label>MakerWorld:</label>
                    <a href="${piece.makerworld_url}" target="_blank" class="external-link">
                      Ver en MakerWorld 🔗
                    </a>
                  </div>
                ` : ''}
              </div>
              
              ${piece.description ? `
                <div class="description-section">
                  <h4>Descripción</h4>
                  <p class="piece-description-full">${piece.description}</p>
                </div>
              ` : ''}
            </div>
            
            <div class="versions-section">
              <h4>Historial de Versiones (${piece.versionCount})</h4>
              <div class="versions-list">
                ${piece.versions.length > 0 ? 
                  piece.versions.map(version => `
                    <div class="version-item">
                      <div class="version-info">
                        <div class="version-id">v${version.id.substring(0, 8)}</div>
                        <div class="version-date">${AdminUtils.formatDateTime(version.created_at)}</div>
                      </div>
                      <div class="version-prices">
                        ${version.total ? `<div class="version-total">${AdminUtils.formatCurrency(version.total)}</div>` : ''}
                        ${version.ml_price ? `<div class="version-ml">ML: ${AdminUtils.formatCurrency(version.ml_price)}</div>` : ''}
                      </div>
                    </div>
                  `).join('') : 
                  '<p>No hay versiones registradas</p>'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Bind close events
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('.modal-overlay').onclick = () => modal.remove();
    
    return modal;
  }

  async viewPieceVersions(pieceId) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece) {
      AdminUtils.showToast('Pieza no encontrada', 'error');
      return;
    }

    // Load detailed version data
    try {
      AdminUtils.showLoading();

      const { data: detailedVersions, error } = await supabaseAdmin
        .from('piece_versions')
        .select('*')
        .eq('piece_id', pieceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Create and show versions modal
      const modal = this.createVersionsModal(piece, detailedVersions);
      document.body.appendChild(modal);
      modal.classList.add('active');

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading piece versions');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  createVersionsModal(piece, versions) {
    const modal = document.createElement('div');
    modal.className = 'modal versions-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content large">
        <div class="modal-header">
          <h3>📊 Versiones de: ${piece.title || 'Pieza sin título'}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="versions-table-container">
            <table class="versions-table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Precio ML</th>
                  <th>Tiempo (h)</th>
                  <th>Filamento (g)</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                ${versions.map(version => `
                  <tr>
                    <td>
                      <div class="version-id">v${version.id.substring(0, 8)}</div>
                    </td>
                    <td>
                      <div class="version-datetime">
                        ${AdminUtils.formatDateTime(version.created_at)}
                      </div>
                    </td>
                    <td class="price-cell">
                      ${AdminUtils.formatCurrency(version.total || 0)}
                    </td>
                    <td class="price-cell">
                      ${AdminUtils.formatCurrency(version.ml_price || 0)}
                    </td>
                    <td>
                      ${version.tiempo_horas || 0}h ${version.tiempo_minutos || 0}m
                    </td>
                    <td>
                      ${version.filamento_gramos || 0}g
                    </td>
                    <td>
                      <button class="action-btn small" onclick="adminPieces.showVersionDetails('${version.id}')">
                        Ver más
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // Bind close events
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('.modal-overlay').onclick = () => modal.remove();
    
    return modal;
  }

  async showVersionDetails(versionId) {
    AdminUtils.showToast('Funcionalidad de detalles de versión en desarrollo', 'info');
  }

  exportPieces() {
    const dataToExport = this.filteredPieces.map(piece => ({
      ID: piece.id,
      Título: piece.title || 'Sin título',
      Descripción: piece.description || '',
      Categoría: this.getCategoryText(piece.category),
      'Precio Estimado': piece.est_price_ars || 0,
      Usuario: piece.user_id,
      Versiones: piece.versionCount,
      Creada: AdminUtils.formatDateTime(piece.created_at),
      Actualizada: AdminUtils.formatDateTime(piece.updated_at),
      'Última Versión': piece.latestVersion ? AdminUtils.formatDateTime(piece.latestVersion.created_at) : 'Sin versiones',
      'MakerWorld URL': piece.makerworld_url || ''
    }));

    AdminUtils.exportToCSV(dataToExport, 'piezas_zetalab');
  }
}

// Make available globally
window.adminPieces = new AdminPieces();
window.AdminPieces = window.adminPieces;

console.log('✅ Admin Pieces Management loaded');