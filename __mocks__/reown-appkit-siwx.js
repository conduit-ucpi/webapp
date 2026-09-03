/**
 * Mock for @reown/appkit-siwx module
 * Used in Jest tests to avoid ES module import issues
 */

// Mock InformalMessenger class
class InformalMessenger {
  constructor(options) {
    this.options = options || {}
  }
}

// Mock SIWXVerifier class
class SIWXVerifier {
  async verify(session) {
    return true
  }
}

// Mock DefaultSIWX class
class DefaultSIWX {
  constructor(config) {
    this.config = config || {}
  }
}

// Mock ReownAuthentication class (base of EmbeddedOnlySIWX)
class ReownAuthentication {
  constructor(config) {
    this.config = config || {}
  }

  async getSessions() {
    return []
  }

  async createMessage(input) {
    return { ...input, toString: () => 'siwx-message' }
  }

  async addSession() {}
}

// Mock storage
class LocalStorage {
  constructor(options) {
    this.options = options || {}
  }

  async set(key, value) {
    return true
  }

  async get(key) {
    return null
  }

  async delete(key) {
    return true
  }
}

module.exports = {
  InformalMessenger,
  SIWXVerifier,
  DefaultSIWX,
  ReownAuthentication,
  LocalStorage,
}
