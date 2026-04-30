#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BellPlugin, "BellPlugin",
    CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
)
