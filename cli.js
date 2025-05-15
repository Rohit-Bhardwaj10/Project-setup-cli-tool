#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { exec } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getProjectInfo() {
  const argName = process.argv[2];
  const questions = [];

  if (!argName) {
    questions.push({
      type: "input",
      name: "projectName",
      message: "📦 What is your project name?",
      validate: (input) =>
        input ? true : "Please enter a valid project name.",
    });
  }

  questions.push({
    type: "list",
    name: "projectType",
    message: "🚀 Choose project type:",
    choices: ["Full-Stack", "Backend Only"],
    default: "Backend Only",
  });

  questions.push({
    type: "list",
    name: "language",
    message: "📝 Choose your backend language:",
    choices: ["JavaScript", "TypeScript"],
    default: "JavaScript",
  });

  // If full-stack, ask for frontend framework
  const initialAnswers = await inquirer.prompt(questions);

  let frontendFramework = null;
  if (initialAnswers.projectType === "Full-Stack") {
    const frontendQuestion = {
      type: "list",
      name: "frontendFramework",
      message: "🎨 Choose your frontend framework:",
      choices: ["React", "Vue", "Svelte"],
      default: "React",
    };

    const frontendAnswer = await inquirer.prompt([frontendQuestion]);
    frontendFramework = frontendAnswer.frontendFramework;
  }

  return {
    projectName: argName || initialAnswers.projectName,
    projectType: initialAnswers.projectType,
    language: initialAnswers.language,
    frontendFramework,
  };
}

async function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const process = exec(command, { cwd });

    process.stdout.on("data", (data) => {
      console.log(chalk.gray(data.toString()));
    });

    process.stderr.on("data", (data) => {
      console.error(chalk.yellow(data.toString()));
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function generateFrontend(projectPath, projectName, framework) {
  const frontendPath = path.join(projectPath, "frontend");

  console.log(chalk.blue(`\n🎨 Setting up ${framework} frontend with Vite...`));

  try {
    // Create frontend directory
    await fs.ensureDir(frontendPath);

    // Determine template based on framework
    let template;
    switch (framework) {
      case "React":
        template = "react";
        break;
      case "Vue":
        template = "vue";
        break;
      case "Svelte":
        template = "svelte";
        break;
      default:
        template = "react";
    }

    // Initialize Vite project
    await runCommand(
      `npm create vite@latest . -- --template ${template}`,
      frontendPath
    );

    // Install dependencies
    console.log(chalk.blue("\n📦 Installing frontend dependencies..."));
    await runCommand("npm install", frontendPath);

    // Add proxy configuration for backend API
    const viteConfigPath = path.join(frontendPath, "vite.config.js");
    let viteConfigContent;

    if (await fs.pathExists(viteConfigPath)) {
      viteConfigContent = await fs.readFile(viteConfigPath, "utf8");

      // Add server proxy config
      if (framework === "React") {
        viteConfigContent = viteConfigContent.replace(
          "export default defineConfig({",
          `export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },`
        );
      } else if (framework === "Vue") {
        viteConfigContent = viteConfigContent.replace(
          "export default defineConfig({",
          `export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },`
        );
      } else if (framework === "Svelte") {
        viteConfigContent = viteConfigContent.replace(
          "export default defineConfig({",
          `export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },`
        );
      }

      await fs.writeFile(viteConfigPath, viteConfigContent);
    }

    // Update package.json to include project name
    const pkgPath = path.join(frontendPath, "package.json");
    const pkg = await fs.readJSON(pkgPath);
    pkg.name = `${projectName}-frontend`;
    await fs.writeJSON(pkgPath, pkg, { spaces: 2 });

    console.log(chalk.green("✅ Frontend setup completed successfully"));
  } catch (error) {
    console.error(chalk.red("❌ Error setting up frontend:"), error);
    throw error;
  }
}

async function generateBackend(backendPath, projectName, language) {
  const isTS = language === "TypeScript";

  // Base config files (common to both)
  const files = {
    ".gitignore": "node_modules\n.env\ndist\n",
    ".env":
      "PORT=5000\nMONGO_URI=mongodb://localhost:27017/" +
      projectName.toLowerCase().replace(/\s+/g, "-") +
      "\n",
    ".env.sample": "PORT=5000\nMONGO_URI=mongodb://localhost:27017/myapp\n",
    ".prettierrc": '{ "semi": true, "singleQuote": true }',
    ".prettierignore": "node_modules\nbuild\ndist\n",
    "Readme.md": `# ${projectName} Backend\n\nGenerated by create-express-mongo CLI.`,
    "package.json": JSON.stringify(
      {
        name: `${projectName}-backend`,
        version: "1.0.0",
        type: "module",
        main: isTS ? "dist/index.js" : "src/index.js",
        scripts: isTS
          ? {
              build: "tsc",
              dev: "nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/index.ts",
              start: "node dist/index.js",
            }
          : { dev: "nodemon src/index.js", start: "node src/index.js" },
        dependencies: {
          cors: "^2.8.5",
          dotenv: "^16.0.3",
          express: "^4.18.2",
          mongoose: "^7.0.3",
        },
        devDependencies: isTS
          ? {
              typescript: "^5.0.4",
              "@types/node": "^20.2.5",
              "@types/express": "^4.17.17",
              "@types/cors": "^2.8.13",
              "@types/mongoose": "^5.11.97",
              "ts-node": "^10.9.1",
              nodemon: "^2.0.22",
            }
          : { nodemon: "^2.0.22" },
      },
      null,
      2
    ),
  };

  if (isTS) {
    files["tsconfig.json"] = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "node",
          outDir: "dist",
          rootDir: "src",
          strict: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true,
          resolveJsonModule: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      },
      null,
      2
    );
  }

  const ext = isTS ? "ts" : "js";

  const srcFiles = {
    [`src/index.${ext}`]: isTS
      ? `import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './db/db';

dotenv.config();

const PORT: number = Number(process.env.PORT) || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
});
`
      : `import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './db/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
});
`,
    [`src/app.${ext}`]: isTS
      ? `import express, { Application } from 'express';
import cors from 'cors';
import exampleRouter from './routes/example.routes';

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use('/api/example', exampleRouter);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

export default app;
`
      : `import express from 'express';
import cors from 'cors';
import exampleRouter from './routes/example.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/example', exampleRouter);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

export default app;
`,
    [`src/constants.${ext}`]: `export const APP_NAME = '${projectName}';`,
    [`src/db/db.${ext}`]: isTS
      ? `import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
`
      : `import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
`,
    [`src/routes/example.routes.${ext}`]: isTS
      ? `import express, { Router } from 'express';
import { getExample } from '../controllers/example.controller';

const router: Router = express.Router();

router.get('/', getExample);

export default router;
`
      : `import express from 'express';
import { getExample } from '../controllers/example.controller.js';

const router = express.Router();

router.get('/', getExample);

export default router;
`,
    [`src/controllers/example.controller.${ext}`]: isTS
      ? `import { Request, Response } from 'express';

export const getExample = (req: Request, res: Response): void => {
  res.json({ message: 'Example route works!' });
};
`
      : `export const getExample = (req, res) => {
  res.json({ message: 'Example route works!' });
};
`,
    [`src/models/example.model.${ext}`]: isTS
      ? `import mongoose, { Document, Schema } from 'mongoose';

export interface IExample extends Document {
  name: string;
}

const ExampleSchema: Schema = new Schema({
  name: { type: String, required: true }
});

export const Example = mongoose.model<IExample>('Example', ExampleSchema);
`
      : `import mongoose from 'mongoose';

const ExampleSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

export const Example = mongoose.model('Example', ExampleSchema);
`,
    [`src/middlewares/logger.${ext}`]: isTS
      ? `import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction): void => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
};
`
      : `export const logger = (req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
};
`,
    [`src/utils/sample.util.${ext}`]: isTS
      ? `export const sayHello = (name: string): string => {
  return \`Hello, \${name}!\`;
};
`
      : `export const sayHello = (name) => {
  return \`Hello, \${name}!\`;
};
`,
  };

  try {
    await fs.ensureDir(backendPath);
    console.log(chalk.green(`📁 Creating backend in ${backendPath}`));

    // Write base files
    for (const [file, content] of Object.entries(files)) {
      await fs.outputFile(path.join(backendPath, file), content);
    }

    // Create folders under src
    const srcPath = path.join(backendPath, "src");
    const folders = [
      "controllers",
      "db",
      "middlewares",
      "models",
      "routes",
      "utils",
    ];
    for (const folder of folders) {
      await fs.ensureDir(path.join(srcPath, folder));
    }

    // Write source files
    for (const [file, content] of Object.entries(srcFiles)) {
      await fs.outputFile(path.join(backendPath, file), content);
    }

    console.log(chalk.green("✅ Backend structure created successfully."));

    // Now install dependencies with live colored output
    console.log(
      chalk.blueBright(
        "\n📦 Installing backend dependencies. This may take a minute..."
      )
    );

    await runCommand("npm install", backendPath);

    console.log(
      chalk.green("\n✅ Backend dependencies installed successfully!\n")
    );

    // Show installed dependencies
    const pkg = await fs.readJSON(path.join(backendPath, "package.json"));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    if (deps.length) {
      console.log(chalk.yellow("Installed backend dependencies:"));
      deps.forEach((dep) => console.log(chalk.cyan(`  - ${dep}`)));
    }

    if (devDeps.length) {
      console.log(chalk.yellow("\nInstalled backend devDependencies:"));
      devDeps.forEach((dep) => console.log(chalk.cyan(`  - ${dep}`)));
    }
  } catch (err) {
    console.error(chalk.red("❌ Error creating backend:"), err);
    throw err;
  }
}

async function generateRootPackageJson(projectPath, projectName, isFullStack) {
  const rootPackage = {
    name: projectName,
    version: "1.0.0",
    private: true,
    workspaces: isFullStack ? ["frontend", "backend"] : ["backend"],
    scripts: isFullStack
      ? {
          dev: 'concurrently "npm run dev:backend" "npm run dev:frontend"',
          "dev:backend": "cd backend && npm run dev",
          "dev:frontend": "cd frontend && npm run dev",
          start: "cd backend && npm start",
        }
      : {
          dev: "cd backend && npm run dev",
          start: "cd backend && npm start",
        },
    devDependencies: {
      concurrently: "^8.0.1",
    },
  };

  await fs.writeJSON(path.join(projectPath, "package.json"), rootPackage, {
    spaces: 2,
  });

  // Create root readme
  const readmeContent = isFullStack
    ? `# ${projectName}

## Full-Stack Application

This project was generated with create-express-mongo CLI.

### Project Structure
- \`/backend\` - Express.js and MongoDB backend
- \`/frontend\` - Frontend application

### Getting Started

Install dependencies:
\`\`\`
npm install
\`\`\`

Run development servers:
\`\`\`
npm run dev
\`\`\`

This will start both the backend server and the frontend development server concurrently.
`
    : `# ${projectName}

## Express MongoDB Application

This project was generated with create-express-mongo CLI.

### Getting Started

Install dependencies:
\`\`\`
npm install
\`\`\`

Run development server:
\`\`\`
npm run dev
\`\`\`
`;

  await fs.writeFile(path.join(projectPath, "README.md"), readmeContent);
}

async function generateProject() {
  try {
    console.log(chalk.bold.cyan("\n🚀 Welcome to Create your App CLI 🚀"));
    console.log(chalk.cyan("═══════════════════════════════════════════\n"));

    const { projectName, projectType, language, frontendFramework } =
      await getProjectInfo();
    const isFullStack = projectType === "Full-Stack";
    const projectPath = path.join(process.cwd(), projectName);

    console.log(
      chalk.bold.blue(
        `\n📂 Setting up ${chalk.bold.green(
          isFullStack ? "full-stack" : "backend-only"
        )} project: ${chalk.bold.yellow(projectName)}`
      )
    );
    console.log(chalk.gray("─".repeat(60)));

    // Ensure project directory exists
    await fs.ensureDir(projectPath);

    if (isFullStack) {
      // Step indicator
      console.log(
        chalk.bold.magenta("\n🔄 Step 1/4: Creating project structure...")
      );

      // Create root package.json for monorepo
      await generateRootPackageJson(projectPath, projectName, true);

      // Step indicator
      console.log(chalk.bold.magenta("\n🔄 Step 2/4: Generating backend..."));

      // Create backend directory
      const backendPath = path.join(projectPath, "backend");
      await generateBackend(backendPath, projectName, language);

      // Step indicator
      console.log(
        chalk.bold.magenta(
          `\n🔄 Step 3/4: Setting up ${frontendFramework} frontend...`
        )
      );

      // Create frontend with chosen framework
      await generateFrontend(projectPath, projectName, frontendFramework);

      // Step indicator
      console.log(
        chalk.bold.magenta("\n🔄 Step 4/4: Installing root dependencies...")
      );

      // Install root dependencies (concurrently)
      console.log(chalk.blue(`\n📦 Installing root project dependencies...`));
      await runCommand("npm install", projectPath);

      console.log(
        chalk.bold.green(
          "\n✨ SUCCESS! Full-Stack project created successfully! ✨"
        )
      );
      console.log(chalk.gray("─".repeat(60)));

      console.log(chalk.bold.magenta(`\n📋 Project Overview:`));
      console.log(
        chalk.yellow(`  • Project Type: ${chalk.white("Full-Stack")}`)
      );
      console.log(chalk.yellow(`  • Backend: ${chalk.white(language)}`));
      console.log(
        chalk.yellow(
          `  • Frontend: ${chalk.white(frontendFramework)} with Vite`
        )
      );
      console.log(chalk.yellow(`  • Database: ${chalk.white("MongoDB")}`));

      console.log(chalk.bold.blue(`\n🚦 Next steps:`));
      console.log(chalk.cyan(`  1. ${chalk.white(`cd ${projectName}`)}`));
      console.log(
        chalk.cyan(
          `  2. ${chalk.white(
            `npm run dev`
          )}     # Run both frontend and backend`
        )
      );
      console.log(
        chalk.cyan(
          `  3. ${chalk.white(
            `npm run dev:frontend`
          )}   # Run only the frontend`
        )
      );
      console.log(
        chalk.cyan(
          `  4. ${chalk.white(`npm run dev:backend`)}    # Run only the backend`
        )
      );

      console.log(chalk.bold.green("\n🎉 Happy coding! 🎉"));
    } else {
      // Step indicator
      console.log(
        chalk.bold.magenta("\n🔄 Step 1/1: Setting up backend project...")
      );

      // Backend only setup
      await generateBackend(projectPath, projectName, language);

      console.log(
        chalk.bold.green(
          "\n✨ SUCCESS! Backend project created successfully! ✨"
        )
      );
      console.log(chalk.gray("─".repeat(60)));

      console.log(chalk.bold.magenta(`\n📋 Project Overview:`));
      console.log(
        chalk.yellow(`  • Project Type: ${chalk.white("Backend Only")}`)
      );
      console.log(chalk.yellow(`  • Language: ${chalk.white(language)}`));
      console.log(chalk.yellow(`  • Framework: ${chalk.white("Express.js")}`));
      console.log(chalk.yellow(`  • Database: ${chalk.white("MongoDB")}`));

      console.log(chalk.bold.blue(`\n🚦 Next steps:`));
      console.log(chalk.cyan(`  1. ${chalk.white(`cd ${projectName}`)}`));
      console.log(chalk.cyan(`  2. ${chalk.white(`npm run dev`)}`));
      if (language === "TypeScript") {
        console.log(
          chalk.cyan(
            `  3. ${chalk.white(
              `npm run build`
            )}    # To compile TypeScript to JavaScript`
          )
        );
      }

      console.log(chalk.bold.green("\n🎉 Happy coding! 🎉"));
    }
  } catch (err) {
    console.error(chalk.bold.red("\n❌ Error creating project:"), err);
    console.log(chalk.red("Please report this issue on GitHub or try again."));
  }
}

generateProject();
