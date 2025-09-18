class ThemeManager {
    constructor() {
        this.themes = {
            light: 'light',
            dark: 'dark',
            system: 'system'
        };
        
        this.currentTheme = this.getStoredTheme() || this.themes.system;
        this.systemTheme = this.getSystemTheme();
        
        this.init();
    }
    
    /**
     * Initialize theme manager
     */
    init() {
        this.createThemeToggle();
        this.applyTheme(this.currentTheme);
        this.setupSystemThemeListener();
        this.setupThemeToggleEvents();
        
        // Update theme on page load
        document.addEventListener('DOMContentLoaded', () => {
            this.updateThemeToggleUI();
        });
    }
    
    /**
     * Get stored theme from localStorage
     */
    getStoredTheme() {
        try {
            return localStorage.getItem('student-tracker-theme');
        } catch (error) {
            console.warn('Could not access localStorage:', error);
            return null;
        }
    }
    
    /**
     * Store theme in localStorage
     */
    storeTheme(theme) {
        try {
            localStorage.setItem('student-tracker-theme', theme);
        } catch (error) {
            console.warn('Could not store theme in localStorage:', error);
        }
    }
    
    /**
     * Get system theme preference
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return this.themes.dark;
        }
        return this.themes.light;
    }
    
    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const html = document.documentElement;
        const body = document.body;
        
        // Remove existing theme classes
        Object.values(this.themes).forEach(t => {
            html.classList.remove(`theme-${t}`);
            body.classList.remove(`theme-${t}`);
        });
        
        // Determine actual theme to apply
        let actualTheme = theme;
        if (theme === this.themes.system) {
            actualTheme = this.getSystemTheme();
        }
        
        // Apply theme classes
        html.classList.add(`theme-${actualTheme}`);
        body.classList.add(`theme-${actualTheme}`);
        
        // Update data attribute for CSS targeting
        html.setAttribute('data-theme', actualTheme);
        
        // Store current theme
        this.currentTheme = theme;
        this.storeTheme(theme);
        
        // Update theme toggle UI
        this.updateThemeToggleUI();
        
        // Dispatch theme change event
        this.dispatchThemeChangeEvent(actualTheme);
    }
    
    /**
     * Create theme toggle button
     */
    createThemeToggle() {
        // Check if toggle already exists
        if (document.getElementById('theme-toggle')) {
            return;
        }
        
        const themeToggle = document.createElement('div');
        themeToggle.id = 'theme-toggle';
        themeToggle.className = 'theme-toggle dropdown';
        themeToggle.innerHTML = `
            <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" 
                    id="themeDropdown" data-bs-toggle="dropdown" aria-expanded="false"
                    title="Change Theme">
                <i class="bi bi-sun-fill theme-icon-light d-none"></i>
                <i class="bi bi-moon-fill theme-icon-dark d-none"></i>
                <i class="bi bi-circle-half theme-icon-system d-none"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end theme-dropdown" aria-labelledby="themeDropdown">
                <li>
                    <h6 class="dropdown-header">
                        <i class="bi bi-palette me-2"></i>Theme
                    </h6>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                    <a class="dropdown-item theme-option" href="#" data-theme="light">
                        <i class="bi bi-sun-fill me-2 text-warning"></i>
                        Light
                        <i class="bi bi-check theme-check d-none ms-auto"></i>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item theme-option" href="#" data-theme="dark">
                        <i class="bi bi-moon-fill me-2 text-info"></i>
                        Dark
                        <i class="bi bi-check theme-check d-none ms-auto"></i>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item theme-option" href="#" data-theme="system">
                        <i class="bi bi-circle-half me-2 text-secondary"></i>
                        System
                        <i class="bi bi-check theme-check d-none ms-auto"></i>
                    </a>
                </li>
            </ul>
        `;
        
        // Find navbar and insert theme toggle
        const navbar = document.querySelector('.navbar .navbar-nav:last-child');
        if (navbar) {
            const listItem = document.createElement('li');
            listItem.className = 'nav-item';
            listItem.appendChild(themeToggle);
            navbar.insertBefore(listItem, navbar.firstChild);
        }
    }
    
    /**
     * Setup theme toggle events
     */
    setupThemeToggleEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-option')) {
                e.preventDefault();
                const theme = e.target.closest('.theme-option').dataset.theme;
                this.setTheme(theme);
            }
        });
    }
    
    /**
     * Setup system theme change listener
     */
    setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                this.systemTheme = this.getSystemTheme();
                if (this.currentTheme === this.themes.system) {
                    this.applyTheme(this.currentTheme);
                }
            });
        }
    }
    
    /**
     * Update theme toggle UI
     */
    updateThemeToggleUI() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;
        
        const lightIcon = toggle.querySelector('.theme-icon-light');
        const darkIcon = toggle.querySelector('.theme-icon-dark');
        const systemIcon = toggle.querySelector('.theme-icon-system');
        
        const lightOption = toggle.querySelector('[data-theme="light"] .theme-check');
        const darkOption = toggle.querySelector('[data-theme="dark"] .theme-check');
        const systemOption = toggle.querySelector('[data-theme="system"] .theme-check');
        
        // Hide all icons and checks
        [lightIcon, darkIcon, systemIcon].forEach(icon => icon?.classList.add('d-none'));
        [lightOption, darkOption, systemOption].forEach(check => check?.classList.add('d-none'));
        
        // Show appropriate icon and check
        switch (this.currentTheme) {
            case this.themes.light:
                lightIcon?.classList.remove('d-none');
                lightOption?.classList.remove('d-none');
                break;
            case this.themes.dark:
                darkIcon?.classList.remove('d-none');
                darkOption?.classList.remove('d-none');
                break;
            case this.themes.system:
                systemIcon?.classList.remove('d-none');
                systemOption?.classList.remove('d-none');
                break;
        }
    }
    
    /**
     * Set theme
     */
    setTheme(theme) {
        if (Object.values(this.themes).includes(theme)) {
            this.applyTheme(theme);
        }
    }
    
    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * Get actual applied theme
     */
    getAppliedTheme() {
        if (this.currentTheme === this.themes.system) {
            return this.getSystemTheme();
        }
        return this.currentTheme;
    }
    
    /**
     * Toggle between light and dark
     */
    toggleTheme() {
        const appliedTheme = this.getAppliedTheme();
        const newTheme = appliedTheme === this.themes.light ? this.themes.dark : this.themes.light;
        this.setTheme(newTheme);
    }
    
    /**
     * Dispatch theme change event
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: {
                theme: theme,
                previousTheme: this.previousTheme
            }
        });
        document.dispatchEvent(event);
        this.previousTheme = theme;
    }
    
    /**
     * Check if dark theme is active
     */
    isDarkTheme() {
        return this.getAppliedTheme() === this.themes.dark;
    }
    
    /**
     * Check if light theme is active
     */
    isLightTheme() {
        return this.getAppliedTheme() === this.themes.light;
    }
    
    /**
     * Check if system theme is active
     */
    isSystemTheme() {
        return this.currentTheme === this.themes.system;
    }
}

// Initialize theme manager when DOM is ready
let themeManager;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        themeManager = new ThemeManager();
    });
} else {
    themeManager = new ThemeManager();
}

// Export for global access
window.ThemeManager = ThemeManager;
window.themeManager = themeManager;

// Utility functions for easy access
window.setTheme = (theme) => themeManager?.setTheme(theme);
window.toggleTheme = () => themeManager?.toggleTheme();
window.getCurrentTheme = () => themeManager?.getCurrentTheme();
window.isDarkTheme = () => themeManager?.isDarkTheme();
window.isLightTheme = () => themeManager?.isLightTheme();


