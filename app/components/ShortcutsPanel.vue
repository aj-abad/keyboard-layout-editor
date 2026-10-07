<script setup lang="ts">
import { computed } from "vue";
import KeyboardShortcut from "#layers/sine/app/components/UI/KeyboardShortcut.vue";
import SidePanel from "#layers/sine/app/components/UI/SidePanel.vue";
import { commands } from "#layers/sine/app/composables/commandRegistry";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * The editor's help: how its work is kept, and its keys. The keys are read
 * from the commands registered right now, so the help can't drift from them
 * (Sine: Patterns › Page composition › A page explains itself in its help).
 */
const app = useLayoutApp();
const GROUPS = ["Edit", "View", "Layout", "Help"] as const;

const groups = computed(() =>
  GROUPS.map((group) => ({
    group,
    rows: commands.value.filter((command) => command.group === group && command.shortcut && !command.hidden),
  })).filter(({ rows }) => rows.length),
);
</script>

<template>
  <SidePanel v-model:is-open="app.helpOpen.value" title="Keyboard shortcuts" size="sm">
    <div class="flex flex-col gap-8 pb-4 select-text">
      <p class="type-body-sm">
        Each layout has a browser tab of its own and saves in this browser as you edit it, so a
        reload or a reopened tab brings it back. Export KLE JSON to keep a portable copy. Drop JSON
        files anywhere in the window to open each in a new tab.
      </p>

      <section aria-labelledby="help-pointer" class="flex flex-col gap-2">
        <h3 id="help-pointer" class="type-label">On the stage</h3>
        <dl class="flex flex-col">
          <div class="help-row">
            <dt>Select several keys</dt>
            <dd>Shift-click, or drag a box</dd>
          </div>
          <div class="help-row">
            <dt>Move or resize</dt>
            <dd>Drag a key, or its edge</dd>
          </div>
          <div class="help-row">
            <dt>Duplicate</dt>
            <dd><KeyboardShortcut keys="alt" /> and drag</dd>
          </div>
          <div class="help-row">
            <dt>Type a legend in place</dt>
            <dd>Double-click it, or <KeyboardShortcut keys="enter" /></dd>
          </div>
          <div class="help-row">
            <dt>Next legend on the key</dt>
            <dd><KeyboardShortcut keys="tab" /></dd>
          </div>
          <div class="help-row">
            <dt>Cancel a drag</dt>
            <dd><KeyboardShortcut keys="escape" /></dd>
          </div>
          <div class="help-row">
            <dt>Nudge</dt>
            <dd><KeyboardShortcut keys="arrowleft" /> to a quarter unit, with <KeyboardShortcut keys="shift" /> a unit</dd>
          </div>
          <div class="help-row">
            <dt>Pan</dt>
            <dd><KeyboardShortcut keys="space" /> and drag</dd>
          </div>
          <div class="help-row">
            <dt>Zoom at the pointer</dt>
            <dd><KeyboardShortcut keys="mod" /> and scroll, or pinch</dd>
          </div>
          <div class="help-row">
            <dt>A key’s menu</dt>
            <dd>Right-click, or <KeyboardShortcut keys="shift+f10" /></dd>
          </div>
        </dl>
      </section>

      <section
        v-for="{ group, rows } in groups"
        :key="group"
        :aria-labelledby="`help-${group}`"
        class="flex flex-col gap-2">
        <h3 :id="`help-${group}`" class="type-label">{{ group }}</h3>
        <dl class="flex flex-col">
          <div v-for="command in rows" :key="command.id" class="help-row">
            <dt>{{ command.name }}</dt>
            <dd><KeyboardShortcut :keys="command.shortcut" /></dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="help-layouts" class="flex flex-col gap-2">
        <h3 id="help-layouts" class="type-label">Layouts in tabs</h3>
        <dl class="flex flex-col">
          <div class="help-row">
            <dt>Reopen a closed layout</dt>
            <dd><KeyboardShortcut keys="mod+shift+t" />, or Open recent</dd>
          </div>
          <div class="help-row">
            <dt>Search everything</dt>
            <dd><KeyboardShortcut keys="mod+k" /></dd>
          </div>
        </dl>
      </section>
    </div>
  </SidePanel>
</template>

<style scoped>
.help-row {
  @apply flex min-h-9 items-center justify-between gap-3 border-b py-1.5 type-body-sm;
}
.help-row dd {
  @apply flex shrink-0 items-center gap-1.5 text-right text-ink-3;
}
</style>
