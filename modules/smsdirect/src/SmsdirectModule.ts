import { NativeModule, requireNativeModule } from 'expo';

declare class SmsdirectModule extends NativeModule<{}> {}

export default requireNativeModule<SmsdirectModule>('Smsdirect');
