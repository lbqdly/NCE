import assert from 'node:assert/strict';
import test from 'node:test';

const classNames = new Set();
globalThis.document = {
  body: {
    classList: {
      toggle(name, enabled) {
        if (enabled) classNames.add(name);
        else classNames.delete(name);
      },
    },
  },
};
globalThis.localStorage = new Map();
globalThis.localStorage.getItem = globalThis.localStorage.get.bind(globalThis.localStorage);
globalThis.localStorage.setItem = globalThis.localStorage.set.bind(globalThis.localStorage);

const { ReadingSystem } = await import('../js/ReadingSystem.js');

function createButton(mode) {
  return {
    dataset: { translationMode: mode },
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
    },
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
  };
}

test('setTranslationMode applies each selected mode and updates all buttons', () => {
  const buttons = ['hide', 'show', 'onlyChinese', 'blur'].map(createButton);
  const system = Object.create(ReadingSystem.prototype);
  system.config = {
    STORAGE_KEYS: { TRANSLATION_MODE: 'translationMode' },
    TRANSLATION_MODES: ['show', 'hide', 'onlyChinese', 'blur'],
  };
  system.state = { translationMode: 'show' };
  system.dom = { translationModeButtons: buttons };

  for (const mode of ['hide', 'show', 'onlyChinese', 'blur']) {
    system.setTranslationMode(mode);
    const activeIndex = buttons.findIndex((button) => button.dataset.translationMode === mode);

    assert.equal(system.state.translationMode, mode);
    assert.equal(localStorage.getItem('translationMode'), mode);
    buttons.forEach((button, index) => {
      assert.equal(button.attributes.get('aria-pressed'), String(index === activeIndex));
      assert.equal(button.classList.values.has('active'), index === activeIndex);
    });
  }

  assert(classNames.has('blur-translation'));
  assert(!classNames.has('hide-translation'));
  assert(!classNames.has('only-chinese-translation'));
});
