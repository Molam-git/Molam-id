Pod::Spec.new do |s|
  s.name             = 'MolamAuth'
  s.version          = '1.0.0'
  s.summary          = 'Molam Auth SDK - Universal authentication for iOS'
  s.description      = <<-DESC
    Molam Auth SDK provides drop-in authentication for iOS apps with:
    - Automatic token rotation
    - Keychain secure storage
    - Session management
    - 2FA support
  DESC

  s.homepage         = 'https://github.com/molam/molam-auth-ios'
  s.license          = { :type => 'Proprietary', :text => 'Copyright 2025 Molam Corporation. All rights reserved.' }
  s.author           = { 'Molam' => 'developers@molam.sn' }
  s.source           = { :git => 'https://github.com/molam/molam-auth-ios.git', :tag => s.version.to_s }

  s.ios.deployment_target = '13.0'
  s.swift_version = '5.0'

  s.source_files = 'MolamAuth/**/*.{swift,h,m}'
  s.public_header_files = 'MolamAuth/**/*.h'

  s.frameworks = 'Foundation', 'Security'

  s.dependency 'Alamofire', '~> 5.8'
  s.dependency 'KeychainAccess', '~> 4.2'
end
