import { registerWebModule, NativeModule } from 'expo';

class SmsdirectModule extends NativeModule<{}> {}

export default registerWebModule(SmsdirectModule, 'SmsdirectModule');
