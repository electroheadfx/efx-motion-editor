import {message, save} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../stores/projectStore';

export type GuardResult = 'saved' | 'discarded' | 'cancelled';

/**
 * Show a native macOS "Save / Don't Save / Cancel" dialog if the project has unsaved changes.
 * Returns 'saved' if the user chose to save (and save succeeded), 'discarded' if they chose
 * not to save (or there were no changes), or 'cancelled' if they cancelled the operation.
 */
export async function guardUnsavedChanges(): Promise<GuardResult> {
  if (!projectStore.isDirty.value) return 'discarded'; // No changes to save

  const result = await message(
    'Do you want to save changes to this project?',
    {
      title: 'EFX Motion Editor',
      kind: 'warning',
      buttons: {
        yes: 'Save',
        no: "Don't Save",
        cancel: 'Cancel',
      },
    },
  );

  if (result === 'Yes') {
    // User wants to save
    if (!projectStore.filePath.value) {
      // Never saved -- open Save As picker
      const filePath = await save({
        filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
        defaultPath: `${projectStore.name.value}.mce`,
      });
      if (!filePath) return 'cancelled'; // User cancelled the save picker
      await projectStore.saveProjectAs(filePath);
    } else {
      await projectStore.saveProject();
    }
    return 'saved';
  }

  if (result === 'No') {
    return 'discarded'; // Don't save -- proceed without saving
  }

  return 'cancelled'; // Cancel -- abort the operation
}
