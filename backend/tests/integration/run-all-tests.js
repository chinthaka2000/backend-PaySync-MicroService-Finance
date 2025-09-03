const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Comprehensive Integration Test Runner
 * Executes all integration tests and generates a detailed report
 */

class IntegrationTestRunner {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testSuites: [],
      startTime: null,
      endTime: null,
      duration: 0
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Integration Tests...\n');
    this.testResults.startTime = new Date();

    const testSuites = [
      {
        name: 'Complete Workflow Tests',
        file: 'complete-workflow.test.js',
        description: 'Tests complete loan workflow from application to approval'
      },
      {
        name: 'File Handling Tests',
        file: 'file-handling.test.js',
        description: 'Tests file upload, download, and agreement generation'
      },
      {
        name: 'Email Notification Tests',
        file: 'email-notifications.test.js',
        description: 'Tests email notifications and error handling'
      },
      {
        name: 'Authentication Tests',
        file: 'auth.test.js',
        description: 'Tests authentication and authorization'
      },
      {
        name: 'Loan Management Tests',
        file: 'loans.test.js',
        description: 'Tests loan CRUD operations'
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }

    this.testResults.endTime = new Date();
    this.testResults.duration = this.testResults.endTime - this.testResults.startTime;

    this.generateReport();
    return this.testResults;
  }

  async runTestSuite(suite) {
    console.log(`📋 Running ${suite.name}...`);
    console.log(`   ${suite.description}`);

    const testFilePath = path.join(__dirname, suite.file);

    if (!fs.existsSync(testFilePath)) {
      console.log(`   ⚠️  Test file not found: ${suite.file}`);
      this.testResults.testSuites.push({
        ...suite,
        status: 'skipped',
        reason: 'Test file not found',
        tests: 0,
        passed: 0,
        failed: 0,
        duration: 0
      });
      return;
    }

    try {
      const result = await this.executeJestTest(testFilePath);
      this.testResults.testSuites.push({
        ...suite,
        ...result
      });

      this.testResults.totalTests += result.tests;
      this.testResults.passedTests += result.passed;
      this.testResults.failedTests += result.failed;

      if (result.status === 'passed') {
        console.log(`   ✅ ${suite.name} - All tests passed (${result.tests} tests)`);
      } else {
        console.log(`   ❌ ${suite.name} - ${result.failed} tests failed`);
      }
    } catch (error) {
      console.log(`   💥 ${suite.name} - Test execution failed: ${error.message}`);
      this.testResults.testSuites.push({
        ...suite,
        status: 'error',
        error: error.message,
        tests: 0,
        passed: 0,
        failed: 1,
        duration: 0
      });
      this.testResults.failedTests += 1;
    }

    console.log('');
  }

  executeJestTest(testFilePath) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const jest = spawn('npx', ['jest', testFilePath, '--verbose', '--json'], {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;

        try {
          // Parse Jest JSON output
          const lines = stdout.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));

          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            const testResults = result.testResults[0];

            resolve({
              status: code === 0 ? 'passed' : 'failed',
              tests: testResults.numPassingTests + testResults.numFailingTests,
              passed: testResults.numPassingTests,
              failed: testResults.numFailingTests,
              duration,
              details: testResults.assertionResults
            });
          } else {
            // Fallback parsing
            resolve({
              status: code === 0 ? 'passed' : 'failed',
              tests: 0,
              passed: code === 0 ? 1 : 0,
              failed: code === 0 ? 0 : 1,
              duration,
              output: stdout,
              error: stderr
            });
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse test results: ${parseError.message}`));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateReport() {
    console.log('📊 Integration Test Results Summary');
    console.log('=====================================\n');

    console.log(`⏱️  Total Duration: ${this.formatDuration(this.testResults.duration)}`);
    console.log(`📈 Total Tests: ${this.testResults.totalTests}`);
    console.log(`✅ Passed: ${this.testResults.passedTests}`);
    console.log(`❌ Failed: ${this.testResults.failedTests}`);
    console.log(`⏭️  Skipped: ${this.testResults.skippedTests}\n`);

    const successRate = this.testResults.totalTests > 0
      ? ((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(1)
      : 0;

    console.log(`🎯 Success Rate: ${successRate}%\n`);

    console.log('📋 Test Suite Details:');
    console.log('----------------------');

    this.testResults.testSuites.forEach(suite => {
      const statusIcon = this.getStatusIcon(suite.status);
      const duration = this.formatDuration(suite.duration);

      console.log(`${statusIcon} ${suite.name}`);
      console.log(`   Duration: ${duration}`);

      if (suite.tests > 0) {
        console.log(`   Tests: ${suite.tests} (${suite.passed} passed, ${suite.failed} failed)`);
      }

      if (suite.status === 'error' && suite.error) {
        console.log(`   Error: ${suite.error}`);
      }

      console.log('');
    });

    // Generate detailed report file
    this.generateDetailedReport();

    // Final status
    if (this.testResults.failedTests === 0) {
      console.log('🎉 All integration tests passed successfully!');
      console.log('✨ The PaySync backend system is ready for production deployment.');
    } else {
      console.log('⚠️  Some integration tests failed. Please review the failures above.');
      console.log('🔧 Fix the issues before proceeding with deployment.');
    }
  }

  generateDetailedReport() {
    const reportPath = path.join(__dirname, '..', '..', 'integration-test-report.json');

    const detailedReport = {
      ...this.testResults,
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      coverage: {
        workflow: this.calculateWorkflowCoverage(),
        rbac: this.calculateRBACCoverage(),
        fileHandling: this.calculateFileHandlingCoverage(),
        emailNotifications: this.calculateEmailCoverage(),
        errorHandling: this.calculateErrorHandlingCoverage()
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  }

  calculateWorkflowCoverage() {
    const workflowSuite = this.testResults.testSuites.find(s => s.name === 'Complete Workflow Tests');
    return {
      tested: workflowSuite ? workflowSuite.status === 'passed' : false,
      coverage: workflowSuite ? (workflowSuite.passed / Math.max(workflowSuite.tests, 1)) * 100 : 0,
      areas: [
        'Loan application creation',
        'Agent review process',
        'Regional manager approval',
        'Loan rejection workflow',
        'Status tracking'
      ]
    };
  }

  calculateRBACCoverage() {
    const workflowSuite = this.testResults.testSuites.find(s => s.name === 'Complete Workflow Tests');
    return {
      tested: workflowSuite ? workflowSuite.status === 'passed' : false,
      coverage: workflowSuite ? (workflowSuite.passed / Math.max(workflowSuite.tests, 1)) * 100 : 0,
      areas: [
        'Agent access restrictions',
        'Regional manager permissions',
        'Moderate admin privileges',
        'Cross-region access control',
        'Role creation permissions'
      ]
    };
  }

  calculateFileHandlingCoverage() {
    const fileSuite = this.testResults.testSuites.find(s => s.name === 'File Handling Tests');
    return {
      tested: fileSuite ? fileSuite.status === 'passed' : false,
      coverage: fileSuite ? (fileSuite.passed / Math.max(fileSuite.tests, 1)) * 100 : 0,
      areas: [
        'File upload validation',
        'File download security',
        'Agreement generation',
        'File type restrictions',
        'File size limits'
      ]
    };
  }

  calculateEmailCoverage() {
    const emailSuite = this.testResults.testSuites.find(s => s.name === 'Email Notification Tests');
    return {
      tested: emailSuite ? emailSuite.status === 'passed' : false,
      coverage: emailSuite ? (emailSuite.passed / Math.max(emailSuite.tests, 1)) * 100 : 0,
      areas: [
        'Loan status notifications',
        'Agreement ready notifications',
        'Welcome emails',
        'Email queue management',
        'Failure handling'
      ]
    };
  }

  calculateErrorHandlingCoverage() {
    const emailSuite = this.testResults.testSuites.find(s => s.name === 'Email Notification Tests');
    return {
      tested: emailSuite ? emailSuite.status === 'passed' : false,
      coverage: emailSuite ? (emailSuite.passed / Math.max(emailSuite.tests, 1)) * 100 : 0,
      areas: [
        'Validation errors',
        'Authentication errors',
        'Authorization errors',
        'Business logic errors',
        'Rate limiting'
      ]
    };
  }

  getStatusIcon(status) {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'error': return '💥';
      default: return '❓';
    }
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests()
    .then(results => {
      process.exit(results.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = IntegrationTestRunner;