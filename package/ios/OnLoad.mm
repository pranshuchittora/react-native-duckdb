#import <Foundation/Foundation.h>
#import "RNDuckDB-Swift-Cxx-Umbrella.hpp"
#import "HybridDuckDB.hpp"

@interface OnLoad : NSObject
@end

@implementation OnLoad

using namespace margelo::nitro;
using namespace margelo::nitro::rnduckdb;

+ (void)load {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
  NSString *documentPath = [paths objectAtIndex:0];
  HybridDuckDB::docPath = [documentPath UTF8String];
}

@end
