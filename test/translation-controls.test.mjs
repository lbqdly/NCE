import assert from 'node:assert/strict';
import test from 'node:test';

const classNames = new Set();
const documentListeners = new Map();
globalThis.document = {
  body: {
    classList: {
      toggle(name, enabled) {
        if (enabled) classNames.add(name);
        else classNames.delete(name);
      },
    },
  },
  addEventListener(event, handler) {
    documentListeners.set(event, handler);
  },
  removeEventListener(event, handler) {
    if (documentListeners.get(event) === handler) documentListeners.delete(event);
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

test('translation shortcuts select modes and ignore editable controls', () => {
  const system = Object.create(ReadingSystem.prototype);
  const selectedModes = [];
  system.dom = { translationModeButtons: [{ dataset: { translationMode: 'hide' } }] };
  system.bindingFlags = { translationShortcuts: false };
  system.eventManager = { clear() {} };
  system.lrcCache = { clear() {} };
  system.audioPreload = { clear() {} };
  system.resourceLoader = { cancel() {} };
  system.setTranslationMode = (mode) => selectedModes.push(mode);

  system.bindTranslationShortcuts();
  const handler = documentListeners.get('keydown');
  assert.equal(typeof handler, 'function');

  for (const [key, mode] of [['1', 'hide'], ['2', 'show'], ['3', 'onlyChinese'], ['4', 'blur']]) {
    const event = { key, target: { tagName: 'BODY' }, preventDefault() { this.prevented = true; } };
    handler(event);
    assert.equal(event.prevented, true);
    assert.equal(selectedModes.at(-1), mode);
  }

  for (const target of [
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
  ]) {
    const ignored = { key: '1', target, preventDefault() { this.prevented = true; } };
    handler(ignored);
    assert.equal(selectedModes.length, 4);
    assert.equal(ignored.prevented, undefined);
  }

  handler({ key: 'x', target: { tagName: 'BODY' }, preventDefault() { throw new Error('should not prevent'); } });
  handler({ key: '1', ctrlKey: true, target: { tagName: 'BODY' }, preventDefault() { throw new Error('should not prevent'); } });
  system.destroy();
  assert.equal(documentListeners.has('keydown'), false);
});
