import {computed} from '@preact/signals';
import {EditorShell} from './components/layout/EditorShell';
import {WelcomeScreen} from './components/project/WelcomeScreen';
import {projectStore} from './stores/projectStore';

const isProjectOpen = computed(() => projectStore.dirPath.value !== null);

export function App() {
  return isProjectOpen.value ? <EditorShell /> : <WelcomeScreen />;
}
