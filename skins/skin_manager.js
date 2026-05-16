// skin_manager.js - Manages templates for different skins
window.SkinManager = {
    _templates: {},

    // Register a skin's templates
    register: function (skinName, templates) {
        this._templates[skinName] = templates;
        console.log(`[SkinManager] Registered templates for skin: ${skinName}`);
    },

    // Get a specific template function for the active skin
    getTemplate: function (skinName, templateName) {
        if (this._templates[skinName] && this._templates[skinName][templateName]) {
            return this._templates[skinName][templateName];
        }

        // Fallback to default skin if template is missing but the skin itself exists
        if (skinName !== 'default' && this._templates['default'] && this._templates['default'][templateName]) {
            console.warn(`[SkinManager] Template '${templateName}' missing in skin '${skinName}', falling back to 'default'.`);
            return this._templates['default'][templateName];
        }

        console.error(`[SkinManager] Template '${templateName}' not found in skin '${skinName}' or 'default'.`);
        return function () { return ''; }; // Return empty string function to avoid crashes
    }
};
