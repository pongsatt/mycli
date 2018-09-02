#!/usr/bin/env node

import * as inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import * as template from './utils/template';
import chalk from 'chalk';

const CHOICES = fs.readdirSync(path.join(__dirname, 'templates'));

const QUESTIONS = [
  {
    name: 'project-choice',
    type: 'list',
    message: 'What project template would you like to generate?',
    choices: CHOICES
  },
  {
    name: 'project-name',
    type: 'input',
    message: 'Project name:',
    validate: (input: string) => {
      if (/^([A-Za-z\-\_\d])+$/.test(input)) return true;
      else return 'Project name may only include letters, numbers, underscores and hashes.';
    }
  }
];

const CURR_DIR = process.cwd();

export interface TemplateConfig {
  files?: string[]
  postMessage?: string
}

export interface CliOptions {
  projectName: string
  templateName: string
  templatePath: string
  tartgetPath: string
  config: TemplateConfig
}

inquirer.prompt(QUESTIONS)
  .then(answers => {
    const projectChoice = answers['project-choice'];
    const projectName = answers['project-name'];
    const templatePath = path.join(__dirname, 'templates', projectChoice);
    const tartgetPath = path.join(CURR_DIR, projectName);
    const templateConfig = getTemplateConfig(templatePath);

    const options : CliOptions = {
      projectName,
      templateName: projectChoice,
      templatePath,
      tartgetPath,
      config: templateConfig
    }

    createProject(tartgetPath);
    createDirectoryContents(templatePath, projectName, templateConfig);
    postProcess(options);
    showMessage(options);
  });

function showMessage(options: CliOptions) {
  var ui = new inquirer.ui.BottomBar();
  ui.write(chalk.green('Done.\n'));
  ui.write(chalk.green(`Go into the project: cd ${options.projectName}\n`));

  const message = options.config.postMessage;

  if (message) {
    ui.write('\n');
    ui.write(chalk.yellow(message));
  }

  ui.close();
}

function getTemplateConfig(templatePath: string): TemplateConfig {
  const configPath = path.join(templatePath, '.template.json');

  if (!fs.existsSync(configPath)) return {};

  const templateConfigContent = fs.readFileSync(configPath);

  if (templateConfigContent) {
    return JSON.parse(templateConfigContent.toString());
  }

  return {};
}

function createProject(projectPath: string) {
  if (fs.existsSync(projectPath)) {
    throw `${projectPath} exists. Please delete first.`;
  }

  fs.mkdirSync(projectPath);
}

function postProcess(options: CliOptions) {
  if (isNode(options)) {
    postProcessNode(options);
  }
}

function isNode(options: CliOptions) {
  return fs.existsSync(path.join(options.templatePath, 'package.json'));
}

function postProcessNode(options: CliOptions) {
  shell.cd(options.tartgetPath);

  if (shell.which('yarn')) {
    shell.exec('yarn');
  } else if (shell.which('npm')){
    shell.exec('npm install');
  } else {
    console.log('No yarn or npm found. Cannot run installation.');
  }
}

const SKIP_FILES = ['node_modules', '.template.json'];

function createDirectoryContents(templatePath: string, projectName: string, config: TemplateConfig) {
  const filesToCreate = fs.readdirSync(templatePath);

  filesToCreate.forEach(file => {
    const origFilePath = path.join(templatePath, file);

    // get stats about the current file
    const stats = fs.statSync(origFilePath);

    if (SKIP_FILES.indexOf(file) > -1) return;

    if (stats.isFile()) {
      let contents = fs.readFileSync(origFilePath, 'utf8');

      contents = template.render(contents, {projectName});

      const writePath = path.join(CURR_DIR, projectName, file);
      fs.writeFileSync(writePath, contents, 'utf8');
    } else if (stats.isDirectory()) {
      fs.mkdirSync(path.join(CURR_DIR, projectName, file));

      // recursive call
      createDirectoryContents(path.join(templatePath, file), path.join(projectName, file), config);
    }
  });
}