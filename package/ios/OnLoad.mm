#import <Foundation/Foundation.h>
#import "RNDuckDB-Swift-Cxx-Umbrella.hpp"
#import "HybridDuckDB.hpp"

@interface OnLoad : NSObject
@end

@implementation OnLoad

using namespace margelo::nitro;
using namespace margelo::nitro::rnduckdb;

+ (void)load {
  NSArray *docPaths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
  NSString *documentPath = [docPaths objectAtIndex:0];

  NSArray *libPaths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, true);
  NSString *libraryPath = [libPaths objectAtIndex:0];

  HybridDuckDB::docPath = [documentPath UTF8String];
  HybridDuckDB::documentsDir = [documentPath UTF8String];
  HybridDuckDB::libraryDir = [libraryPath UTF8String];
  HybridDuckDB::databaseDir = [documentPath UTF8String];
  HybridDuckDB::externalDir = "";
}

@end
