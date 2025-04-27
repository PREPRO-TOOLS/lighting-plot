import { CoreProtection, FeatureFlags } from './core/protection.js';
import StateValidator from './core/state-validator.js';
import DataIntegrity from './core/data-integrity.js';
import AutoRecovery from './core/auto-recovery.js';
import SceneManager from './core/scene-manager.js';
import EquipmentManager from './core/equipment-manager.js';
import EnvironmentManager from './core/environment-manager.js';

// Initialize protection systems
CoreProtection.protectModule('SceneManager', SceneManager, '1.0.0');
CoreProtection.protectModule('EquipmentManager', EquipmentManager, '1.0.0');
CoreProtection.protectModule('EnvironmentManager', EnvironmentManager, '1.0.0');

// Create initial stable checkpoint
CoreProtection.createCheckpoint('STABLE_V1');

// Initialize state validator
StateValidator.setState('initializing');

// Initialize data integrity checker
DataIntegrity.initializeCommonRules();

// Initialize auto-recovery system
AutoRecovery.initializeCommonStrategies();

// Set up feature flags
FeatureFlags.setFlag('enable_new_ui', false);
FeatureFlags.setFlag('enable_new_drag_drop', false);
FeatureFlags.setFlag('enable_experimental', false);

// Initialize application with protection
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Validate initial state
        StateValidator.validateOperation('initialization', 'initializing');
        
        // Initialize core modules
        await SceneManager.init();
        await EquipmentManager.init();
        await EnvironmentManager.init();
        
        // Add room to scene
        const room = EnvironmentManager.getRoom();
        SceneManager.addToScene(room);
        
        // Take initial snapshot
        const initialState = {
            scene: SceneManager.getState(),
            equipment: EquipmentManager.getState(),
            environment: EnvironmentManager.getCurrentEnvironment()
        };
        
        // Validate initial state
        DataIntegrity.validateScene(initialState.scene);
        DataIntegrity.validateEnvironment(initialState.environment);
        AutoRecovery.takeSnapshot(initialState);
        
        // Start animation loop with protection
        SceneManager.animate();
        
        // Set up protected window resize handler
        window.addEventListener('resize', () => {
            try {
                StateValidator.validateOperation('resize', 'ready');
                SceneManager.resize();
            } catch (error) {
                AutoRecovery.handleError(error, { operation: 'resize' });
            }
        });
        
        // Set state to ready
        StateValidator.setState('ready');
        
        console.log('Application initialized successfully');
        console.log('Protected modules:', {
            scene: CoreProtection.getModuleStatus('SceneManager'),
            equipment: CoreProtection.getModuleStatus('EquipmentManager'),
            environment: CoreProtection.getModuleStatus('EnvironmentManager')
        });
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Handle initialization error
        const recoveryAction = AutoRecovery.handleError(error, { 
            phase: 'initialization',
            lastState: StateValidator.getCurrentState()
        });
        
        // Apply recovery action
        if (recoveryAction.action === 'reinitialize_renderer') {
            // Reinitialize with reduced settings
            SceneManager.initializeWithSettings(recoveryAction.settings);
        } else if (recoveryAction.action === 'restore_snapshot') {
            // Restore last known good state
            const lastGoodState = AutoRecovery.restoreSnapshot(recoveryAction.snapshotIndex);
            SceneManager.setState(lastGoodState.scene);
            EquipmentManager.setState(lastGoodState.equipment);
            EnvironmentManager.setEnvironment(lastGoodState.environment);
        }
    }
});

// Protected equipment creation
window.createEquipmentInScene = function(data, position) {
    try {
        // Validate state
        StateValidator.validateOperation('createEquipment', 'ready');
        
        // Validate equipment data
        DataIntegrity.validateEquipment(JSON.parse(data));
        
        // Create equipment
        const equipment = EquipmentManager.createEquipment(data, position);
        
        // Take snapshot after successful creation
        const currentState = {
            scene: SceneManager.getState(),
            equipment: EquipmentManager.getState(),
            environment: EnvironmentManager.getCurrentEnvironment()
        };
        AutoRecovery.takeSnapshot(currentState);
        
        return equipment;
    } catch (error) {
        console.error('Error creating equipment:', error);
        return AutoRecovery.handleError(error, {
            operation: 'createEquipment',
            data: data,
            position: position
        });
    }
};

// Protected environment setup
window.setEnvironment = function(envType) {
    try {
        // Validate state
        StateValidator.validateOperation('setEnvironment', 'ready');
        
        // Take snapshot before change
        const beforeState = {
            scene: SceneManager.getState(),
            equipment: EquipmentManager.getState(),
            environment: EnvironmentManager.getCurrentEnvironment()
        };
        AutoRecovery.takeSnapshot(beforeState);
        
        // Update environment
        const newRoom = EnvironmentManager.setEnvironment(envType);
        SceneManager.clearScene();
        SceneManager.addToScene(newRoom);
        
        // Validate new state
        const afterState = {
            scene: SceneManager.getState(),
            equipment: EquipmentManager.getState(),
            environment: EnvironmentManager.getCurrentEnvironment()
        };
        DataIntegrity.validateScene(afterState.scene);
        DataIntegrity.validateEnvironment(afterState.environment);
        
        // Take snapshot after successful change
        AutoRecovery.takeSnapshot(afterState);
    } catch (error) {
        console.error('Error setting environment:', error);
        const recoveryAction = AutoRecovery.handleError(error, {
            operation: 'setEnvironment',
            envType: envType
        });
        
        if (recoveryAction.action === 'restore_snapshot') {
            const lastGoodState = AutoRecovery.restoreSnapshot(recoveryAction.snapshotIndex);
            SceneManager.setState(lastGoodState.scene);
            EquipmentManager.setState(lastGoodState.equipment);
            EnvironmentManager.setEnvironment(lastGoodState.environment);
        }
    }
};

// Global variables
let scene, camera, renderer, controls;
let room = null;
let lights = [];
let labelRenderer;

// Constants for materials
const MATERIALS = {
    FLOOR: new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.8 
    }),
    WALL: new THREE.MeshStandardMaterial({ 
        color: 0xCCCCCC,
        roughness: 0.6 
    }),
    WINDOW: new THREE.MeshPhysicalMaterial({
        color: 0xAAAAAA,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1
    }),
    FRAME: new THREE.LineBasicMaterial({
        color: 0x000000
    })
};

// Environment definitions
const ENVIRONMENTS = {
    studio: {
        width: 32,
        length: 32,
        height: 20,
        features: {
            windows: [
                { x: 0, y: 10, z: 16, width: 8, height: 8 },
                { x: 32, y: 10, z: 16, width: 8, height: 8 }
            ],
            doors: [
                { x: 16, y: 0, z: 0, width: 4, height: 8 }
            ]
        }
    },
    // Add more environment presets as needed
};

// Add environment setup workflow
let environmentLocked = false;
let currentEnvironmentDimensions = {
    width: 32,
    length: 32,
    height: 20
};

// Helper Functions
function createWall(width, height, position, rotation = { x: 0, y: 0, z: 0 }) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, MATERIALS.WALL);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    return mesh;
}

function createWindow(width, height, position) {
    const group = new THREE.Group();
    
    // Window pane
    const windowGeometry = new THREE.PlaneGeometry(width, height);
    const windowMesh = new THREE.Mesh(windowGeometry, MATERIALS.WINDOW);
    
    // Window frame
    const frameGeometry = new THREE.EdgesGeometry(windowGeometry);
    const frameMesh = new THREE.LineSegments(frameGeometry, MATERIALS.FRAME);
    
    group.add(windowMesh);
    group.add(frameMesh);
    group.position.set(position.x, position.y, position.z);
    
    return group;
}

function createDoor(width, height, position) {
    const group = new THREE.Group();
    
    // Door panel
    const doorGeometry = new THREE.PlaneGeometry(width, height);
    const doorMesh = new THREE.Mesh(doorGeometry, MATERIALS.WALL);
    
    // Door frame
    const frameGeometry = new THREE.EdgesGeometry(doorGeometry);
    const frameMesh = new THREE.LineSegments(frameGeometry, MATERIALS.FRAME);
    
    group.add(doorMesh);
    group.add(frameMesh);
    group.position.set(position.x, position.y, position.z);
    
    return group;
}

// Environment definitions
const environments = {
    studio: {
        name: 'Sound Stage',
        features: {
            grid: {
                height: 30,
                spacing: 2,
                color: 0x444444,
                create: function() {
                    const group = new THREE.Group();
                    
                    // Create pipe grid
                    for(let x = -15; x <= 15; x += 2) {
                        for(let z = -15; z <= 15; z += 2) {
                            const pipe = new THREE.Mesh(
                                new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8),
                                new THREE.MeshStandardMaterial({color: this.color})
                            );
                            pipe.position.set(x, this.height, z);
                            group.add(pipe);
                        }
                    }
                    
                    // Add main support beams
                    const beams = [
                        {start: [-15, this.height, 0], end: [15, this.height, 0]},
                        {start: [0, this.height, -15], end: [0, this.height, 15]}
                    ];
                    
                    beams.forEach(beam => {
                        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 30, 8);
                        geometry.rotateZ(Math.PI/2);
                        const mesh = new THREE.Mesh(
                            geometry,
                            new THREE.MeshStandardMaterial({color: 0x666666})
                        );
                        mesh.position.set(...beam.start.map((v, i) => (v + beam.end[i])/2));
                        group.add(mesh);
                    });
                    
                    return group;
                }
            },
            walls: {
                color: 0x222222,
                create: function(width, length, height) {
                    const group = new THREE.Group();
                    
                    // Floor
                    const floor = new THREE.Mesh(
                        new THREE.PlaneGeometry(width, length),
                        new THREE.MeshStandardMaterial({
                            color: 0x333333,
                            roughness: 0.8
                        })
                    );
                    floor.rotation.x = -Math.PI/2;
                    group.add(floor);
                    
                    // Walls
                    const wallGeometry = new THREE.PlaneGeometry(width, height);
                    const wallMaterial = new THREE.MeshStandardMaterial({
                        color: this.color,
                        roughness: 0.7
                    });
                    
                    // Back wall
                    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
                    backWall.position.z = -length/2;
                    backWall.position.y = height/2;
                    group.add(backWall);
                    
                    // Side walls
                    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
                    leftWall.rotation.y = Math.PI/2;
                    leftWall.position.x = -width/2;
                    leftWall.position.y = height/2;
                    group.add(leftWall);
                    
                    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
                    rightWall.rotation.y = -Math.PI/2;
                    rightWall.position.x = width/2;
                    rightWall.position.y = height/2;
                    group.add(rightWall);
                    
                    return group;
                }
            }
        }
    },
    warehouse: {
        name: 'Warehouse',
        features: {
            windows: {
                create: function(width, height) {
                    const group = new THREE.Group();
                    const windowCount = Math.floor(width/4);
                    
                    for(let i = 0; i < windowCount; i++) {
                        const window = new THREE.Mesh(
                            new THREE.PlaneGeometry(2, 3),
                            new THREE.MeshStandardMaterial({
                                color: 0x88CCFF,
                                transparent: true,
                                opacity: 0.3
                            })
                        );
                        window.position.set(
                            (-width/2 + 2) + i * 4,
                            height - 4,
                            -width/2
                        );
                        group.add(window);
                    }
                    return group;
                }
            },
            walls: {
                create: function(width, length, height) {
                    const group = new THREE.Group();
                    
                    // Walls with brick texture
                    const wallMaterial = new THREE.MeshStandardMaterial({
                        color: 0x8B4513, // Brown color for brick
                        roughness: 0.9
                    });
                    
                    // Walls
                    const wallGeometry = new THREE.PlaneGeometry(width, height);
                    
                    ['back', 'left', 'right'].forEach(side => {
                        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                        switch(side) {
                            case 'back':
                                wall.position.z = -length/2;
                                break;
                            case 'left':
                                wall.rotation.y = Math.PI/2;
                                wall.position.x = -width/2;
                                break;
                            case 'right':
                                wall.rotation.y = -Math.PI/2;
                                wall.position.x = width/2;
                                break;
                        }
                        wall.position.y = height/2;
                        group.add(wall);
                    });
                    
                    // Concrete floor
                    const floor = new THREE.Mesh(
                        new THREE.PlaneGeometry(width, length),
                        new THREE.MeshStandardMaterial({
                            color: 0x999999,
                            roughness: 0.8
                        })
                    );
                    floor.rotation.x = -Math.PI/2;
                    group.add(floor);
                    
                    return group;
                }
            }
        }
    },
    blank: {
        name: 'Blank Canvas',
        features: {
            walls: {
                create: function(width, length, height) {
                    const group = new THREE.Group();
                    
                    // White walls
                    const wallMaterial = new THREE.MeshStandardMaterial({
                        color: 0xFFFFFF,
                        roughness: 0.1
                    });
                    
                    // Floor
                    const floor = new THREE.Mesh(
                        new THREE.PlaneGeometry(width, length),
                        wallMaterial
                    );
                    floor.rotation.x = -Math.PI/2;
                    group.add(floor);
                    
                    return group;
                }
            }
        }
    }
};

// Function to set environment
window.setEnvironment = function(envType) {
    if (environmentLocked) {
        console.log('Environment is locked. Please reset to change.');
        return;
    }

    console.log('Setting environment:', envType);
    
    // Check if scene is initialized
    if (!scene) {
        console.error('Scene not initialized yet');
        return;
    }
    
    // Clear existing environment
    if (room) {
        console.log('Removing existing room');
        scene.remove(room);
    }
    
    // Clear existing lights
    console.log('Clearing existing lights');
    lights.forEach(light => scene.remove(light));
    lights = [];
    
    const envConfig = environments[envType];
    if (!envConfig) {
        console.error('Environment type not found:', envType);
        return;
    }
    
    console.log('Creating new environment:', envConfig.name);
    
    // Create setup panel if it doesn't exist
    let setupPanel = document.getElementById('environmentSetup');
    if (!setupPanel) {
        createEnvironmentSetup();
    }
    
    // Show setup panel
    setupPanel = document.getElementById('environmentSetup');
    if (setupPanel) {
        setupPanel.style.display = 'block';
    }
    
    // Create new environment group
    room = new THREE.Group();
    
    // Add environment-specific features
    Object.entries(envConfig.features).forEach(([key, feature]) => {
        if (feature.create) {
            console.log('Adding feature:', key);
            const element = feature.create(
                currentEnvironmentDimensions.width,
                currentEnvironmentDimensions.length,
                currentEnvironmentDimensions.height
            );
            if (element) {
                room.add(element);
            }
        }
    });
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
    scene.add(ambientLight);
    lights.push(ambientLight);
    
    // Add directional light
    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    lights.push(dirLight);
    
    // Add environment to scene
    scene.add(room);
    
    // Reset camera to a better default position
    camera.position.set(30, 30, 30);
    controls.target.set(0, 10, 0);
    controls.update();
    
    console.log('Environment setup complete');
    
    // Force a render
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
};

// Make generateLightingDesign available globally
window.generateLightingDesign = function() {
    const description = document.getElementById('sceneDescription').value;
    const analysis = analyzePrompt(description);
    createEquipmentFromAnalysis(analysis);
    updateGearRecommendations(description);
};

// Lighting Equipment Database with real-world specs
const lightingEquipment = {
    'LED': {
        'ARRI': [
            { 
                name: 'SkyPanel S360-C',
                type: 'LED Panel',
                dimensions: { width: 55.9, height: 25.3, depth: 7.9 }, // inches
                beamAngle: { spot: 105, flood: 115 }, // degrees
                output: { distance: 9.8, fc: 188 }, // footcandles at distance
                power: '2000W equivalent'
            },
            { 
                name: 'SkyPanel S60-C',
                type: 'LED Panel',
                dimensions: { width: 25.4, height: 11.8, depth: 6.7 },
                beamAngle: { spot: 115, flood: 125 },
                output: { distance: 6.6, fc: 139 },
                power: '650W equivalent'
            }
        ],
        'APUTURE': [
            {
                name: '600D Pro',
                type: 'LED Fresnel',
                dimensions: { width: 12.8, height: 10.2, depth: 7.1 },
                beamAngle: { spot: 15, flood: 45 },
                output: { distance: 9.8, fc: 9700 }, // with fresnel lens
                power: '600W'
            },
            {
                name: '300X',
                type: 'LED Fresnel',
                dimensions: { width: 11.8, height: 9.1, depth: 6.3 },
                beamAngle: { spot: 20, flood: 55 },
                output: { distance: 9.8, fc: 4800 },
                power: '300W'
            }
        ]
    },
    'HMI': {
        'ARRI': [
            {
                name: 'M18',
                type: 'HMI Fresnel',
                dimensions: { width: 22.8, height: 18.9, depth: 14.2 },
                beamAngle: { spot: 12, flood: 50 },
                output: { distance: 19.7, fc: 1850 },
                power: '1800W'
            },
            {
                name: 'M90',
                type: 'HMI Fresnel',
                dimensions: { width: 31.5, height: 27.6, depth: 19.7 },
                beamAngle: { spot: 8, flood: 55 },
                output: { distance: 32.8, fc: 4300 },
                power: '9000W'
            }
        ]
    },
    'Grip': {
        'Overhead': [
            {
                name: '20x20 Frame',
                type: 'Overhead Frame',
                riggingRequirements: [
                    '4x 1-ton motors',
                    'Safety cables',
                    'Load test certification'
                ],
                setupInstructions: [
                    'Verify structural support points',
                    'Install motors at designated points',
                    'Assemble frame on ground',
                    'Attach safety cables',
                    'Raise to working height'
                ]
            },
            {
                name: '12x12 Frame',
                type: 'Overhead Frame',
                riggingRequirements: [
                    '2x 1/2-ton motors',
                    'Safety cables',
                    'Load test certification'
                ],
                setupInstructions: [
                    'Verify structural support points',
                    'Install motors at designated points',
                    'Assemble frame on ground',
                    'Attach safety cables',
                    'Raise to working height'
                ]
            }
        ],
        'Fabrics': [
            {
                name: '20x20 UltraBounce',
                type: 'Reflector',
                specs: 'Double-sided White/Black'
            },
            {
                name: '12x12 UltraBounce',
                type: 'Reflector',
                specs: 'Double-sided White/Black'
            },
            {
                name: '8x8 UltraBounce',
                type: 'Reflector',
                specs: 'Double-sided White/Black'
            }
        ],
        'Support': [
            {
                name: 'C-Stand',
                type: 'Support',
                specs: 'Chrome plated, 40" arm'
            },
            {
                name: 'Menace Arm',
                type: 'Support',
                specs: '8ft reach, 100lb capacity'
            }
        ]
    }
};

// Scene presets for common lighting setups
const lightingPresets = {
    'interview': {
        name: 'Interview Setup - High Key',
        description: 'Classic three-point lighting setup for interviews',
        lights: [
            { type: 'key', position: [2, 2, -2], intensity: 1.0, fixture: 'ARRI SkyPanel S60-C' },
            { type: 'fill', position: [-2, 1.5, -1], intensity: 0.5, fixture: 'LiteMat+ Plus 4' },
            { type: 'back', position: [-1, 2, 2], intensity: 0.7, fixture: 'LiteMat+ Plus 4' }
        ]
    },
    'noir': {
        name: 'Film Noir Scene',
        description: 'Dramatic high-contrast lighting with strong shadows',
        lights: [
            { type: 'key', position: [3, 3, -2], intensity: 1.0, fixture: 'ARRI M18' },
            { type: 'rim', position: [-2, 2, 2], intensity: 0.8, fixture: 'ARRI T12' }
        ]
    },
    'product': {
        name: 'Product Photography',
        description: 'Soft, even lighting for product shots',
        lights: [
            { type: 'main', position: [0, 3, 0], intensity: 1.0, fixture: 'ARRI SkyPanel S360-C' },
            { type: 'fill1', position: [-2, 1, -2], intensity: 0.6, fixture: 'LiteMat+ Plus 8' },
            { type: 'fill2', position: [2, 1, -2], intensity: 0.6, fixture: 'LiteMat+ Plus 8' }
        ]
    }
};

// Enhanced prompt analysis for lighting terminology
function analyzePrompt(description) {
    const analysis = {
        overhead: null,  // Will contain overhead setup if specified
        negFill: [],    // Will contain negative fill setups
        lights: [],     // Will contain individual lights
        modifiers: []   // Will contain flags, diffusion, etc.
    };
    
    // Parse overhead setups (e.g., "20x20 in ceiling")
    const overheadMatch = description.match(/(\d+)x(\d+)\s+(?:in\s+)?(?:ceiling|overhead|grid)/i);
    if (overheadMatch) {
        analysis.overhead = {
            size: {
                width: parseInt(overheadMatch[1]),
                length: parseInt(overheadMatch[2])
            },
            lights: []
        };
        
        // Look for lights in the overhead
        const skyPanelMatch = description.match(/(\d+)\s+(?:sky\s*panels?|s\d+s?)/i);
        if (skyPanelMatch) {
            const numPanels = parseInt(skyPanelMatch[1]);
            // Calculate even distribution in the overhead space
            const spacing = analysis.overhead.size.width / (Math.ceil(Math.sqrt(numPanels)));
            let panelsPlaced = 0;
            
            for (let x = -analysis.overhead.size.width/2 + spacing; 
                 panelsPlaced < numPanels && x < analysis.overhead.size.width/2; 
                 x += spacing) {
                for (let z = -analysis.overhead.size.length/2 + spacing; 
                     panelsPlaced < numPanels && z < analysis.overhead.size.length/2; 
                     z += spacing) {
                    analysis.overhead.lights.push({
                        type: 'ARRI SkyPanel S60-C',
                        position: new THREE.Vector3(x, environments.studio.features.grid.height - 1, z),
                        rotation: new THREE.Euler(-Math.PI/2, 0, 0) // Point downward
                    });
                    panelsPlaced++;
                }
            }
        }
    }
    
    // Parse negative fill (e.g., "8x8 neg")
    const negMatch = description.match(/(\d+)x(\d+)\s+neg/i);
    if (negMatch) {
        analysis.negFill.push({
            size: {
                width: parseInt(negMatch[1]),
                height: parseInt(negMatch[2])
            },
            type: 'UltraBounce',
            side: 'black',
            // Default position - user can drag to adjust
            position: new THREE.Vector3(-5, 6, -5),
            rotation: new THREE.Euler(0, Math.PI/4, 0)
        });
    }
    
    return analysis;
}

// View control definitions
const viewControls = {
    freeOrbit: {
        position: null,  // Will maintain current position
        target: new THREE.Vector3(0, 0, 0),
        label: '🔄 Free Orbit'
    },
    top: {
        position: new THREE.Vector3(0, 30, 0),
        target: new THREE.Vector3(0, 0, 0),
        label: '⬇️ Top View'
    },
    side: {
        position: new THREE.Vector3(30, 2, 0),
        target: new THREE.Vector3(0, 2, 0),
        label: '➡️ Side View'
    },
    front: {
        position: new THREE.Vector3(0, 2, 30),
        target: new THREE.Vector3(0, 2, 0),
        label: '↗️ Front View'
    }
};

// Create view control panel
function createViewControls() {
    const panel = document.createElement('div');
    panel.id = 'viewControls';
    panel.style.cssText = `
        position: absolute;
        left: 20px;
        top: 20px;
        background: rgba(0,0,0,0.7);
        padding: 10px;
        border-radius: 5px;
        color: white;
        z-index: 1000;
    `;

    Object.entries(viewControls).forEach(([viewName, view]) => {
        const button = document.createElement('button');
        button.id = viewName;
        button.innerHTML = view.label;
        button.style.cssText = `
            display: block;
            margin: 5px;
            padding: 8px 15px;
            background: #444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            width: 120px;
            text-align: left;
            transition: background-color 0.3s;
        `;
        
        button.addEventListener('mouseover', () => button.style.background = '#555');
        button.addEventListener('mouseout', () => button.style.background = '#444');
        button.addEventListener('click', () => switchView(viewName));
        
        panel.appendChild(button);
    });

    document.body.appendChild(panel);
}

// Function to switch between views with smooth transition
function switchView(viewName) {
    const view = viewControls[viewName];
    
    if (viewName === 'freeOrbit') {
        controls.enabled = true;
        camera.position.set(30, 30, 30);
        controls.target.set(0, 10, 0);
        controls.update();
    }

    // Store current camera state
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // Temporarily disable orbit controls
    controls.enabled = false;

    // Animation settings
    const duration = 1000; // 1 second
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing
        const eased = progress < 0.5 ? 
            2 * progress * progress : 
            -1 + (4 - 2 * progress) * progress;

        // Update camera position
        camera.position.lerpVectors(startPos, view.position, eased);
        controls.target.lerpVectors(startTarget, view.target, eased);
        
        camera.lookAt(controls.target);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Re-enable orbit controls after transition
            if (viewName !== 'freeOrbit') {
                controls.enabled = true;
            }
        }
    }

    animate();
}

// Add keyboard shortcuts for views
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case '1':
            switchView('freeOrbit');
            break;
        case '2':
            switchView('top');
            break;
        case '3':
            switchView('side');
            break;
        case '4':
            switchView('front');
            break;
    }
});

// Add environment selector UI
function createEnvironmentSelector() {
    const selector = document.createElement('div');
    selector.id = 'environmentSelector';
    selector.style.cssText = `
        position: absolute;
        left: 20px;
        bottom: 20px;
        background: rgba(0,0,0,0.7);
        padding: 10px;
        border-radius: 5px;
        color: white;
        z-index: 1000;
    `;
    
    const label = document.createElement('div');
    label.textContent = 'Environment:';
    label.style.marginBottom = '8px';
    selector.appendChild(label);
    
    Object.keys(environments).forEach(envKey => {
        const button = document.createElement('button');
        button.textContent = environments[envKey].name;
        button.style.cssText = `
            display: block;
            margin: 5px;
            padding: 8px 15px;
            background: #444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            width: 120px;
            text-align: left;
        `;
        button.addEventListener('click', () => setEnvironment(envKey));
        selector.appendChild(button);
    });
    
    document.body.appendChild(selector);
}

// Initialize the 3D scene
function initScene() {
    console.log('Initializing scene...');
    
    // Wait for DOM to be ready
    if (!document.getElementById('diagramContainer')) {
        console.error('Container not found!');
        return;
    }
    
    // Initialize scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Set up camera with wider FOV and farther clipping plane
    const container = document.getElementById('diagramContainer');
    console.log('Container dimensions:', container.clientWidth, container.clientHeight);
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000); // Increased FOV to 75 and far plane to 2000
    camera.position.set(30, 30, 30); // Moved camera further out
    camera.lookAt(0, 0, 0);
    
    // Set up WebGL renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Set up CSS2D renderer for labels
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    
    // Set up controls with adjusted limits
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.65;
    controls.minPolarAngle = 0;
    controls.minDistance = 5;
    controls.maxDistance = 100; // Increased max distance
    controls.target.set(0, 10, 0);
    
    // Add initial ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // Add initial directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    
    // Set up view controls
    setupViewControls();
    
    // Start animation loop
    animate();
    
    // Set initial environment
    console.log('Setting initial environment...');
    setEnvironment('blank');
    
    createEnvironmentSetup();
    
    // Hide equipment panel initially
    const equipmentPanel = document.getElementById('equipmentPanel');
    if (equipmentPanel) {
        equipmentPanel.style.display = 'none';
    }
    
    console.log('Scene initialization complete');
}

// Set up view controls
function setupViewControls() {
    // Free Orbit View
    document.getElementById('freeOrbit').addEventListener('click', () => {
        controls.enabled = true;
        camera.position.set(30, 30, 30);
        controls.target.set(0, 10, 0);
        controls.update();
    });

    // Top View
    document.getElementById('topView').addEventListener('click', () => {
        controls.enabled = false;
        camera.position.set(0, 80, 0);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    });

    // Side View
    document.getElementById('sideView').addEventListener('click', () => {
        controls.enabled = false;
        camera.position.set(80, 20, 0);
        camera.lookAt(0, 20, 0);
        controls.target.set(0, 20, 0);
        controls.update();
    });

    // Front View
    document.getElementById('frontView').addEventListener('click', () => {
        controls.enabled = false;
        camera.position.set(0, 20, 80);
        camera.lookAt(0, 20, 0);
        controls.target.set(0, 20, 0);
        controls.update();
    });
}

// Make sure Three.js is loaded before initializing
window.addEventListener('load', () => {
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded!');
        return;
    }
    
    console.log('Starting initialization...');
    initScene();
    
    // Create and show equipment panel immediately
    const equipmentPanel = document.getElementById('equipmentPanel');
    if (equipmentPanel) {
        equipmentPanel.style.display = 'block';
        createEquipmentPanel();
    } else {
        console.error('Equipment panel element not found');
    }
    
    setupDropZone();
    
    // Initialize event listeners
    initEventListeners();
});

// Create room based on dimensions
function createRoom(environment = ENVIRONMENTS.studio) {
    const group = new THREE.Group();
    
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(environment.width, environment.length);
    const floor = new THREE.Mesh(floorGeometry, MATERIALS.FLOOR);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);
    
    // Walls
    const walls = [
        // Back wall
        createWall(environment.width, environment.height, 
            { x: environment.width/2, y: environment.height/2, z: 0 }),
        // Front wall
        createWall(environment.width, environment.height, 
            { x: environment.width/2, y: environment.height/2, z: environment.length },
            { x: 0, y: Math.PI, z: 0 }),
        // Left wall
        createWall(environment.length, environment.height, 
            { x: 0, y: environment.height/2, z: environment.length/2 },
            { x: 0, y: Math.PI/2, z: 0 }),
        // Right wall
        createWall(environment.length, environment.height, 
            { x: environment.width, y: environment.height/2, z: environment.length/2 },
            { x: 0, y: -Math.PI/2, z: 0 })
    ];
    walls.forEach(wall => group.add(wall));
    
    // Add windows
    environment.features.windows.forEach(window => {
        group.add(createWindow(window.width, window.height, 
            { x: window.x, y: window.y, z: window.z }));
    });
    
    // Add doors
    environment.features.doors.forEach(door => {
        group.add(createDoor(door.width, door.height, 
            { x: door.x, y: door.y, z: door.z }));
    });
    
    return group;
}

// Improved equipment creation with better error handling
function createLight(type, position, fixture) {
    const group = new THREE.Group();
    
    // Get fixture specs
    const specs = findFixtureSpecs(fixture);
    
    // Create base shape based on fixture type
    if (fixture.includes('SkyPanel')) {
        // Create main housing - flat panel style
        const housing = new THREE.BoxGeometry(2, 1.2, 0.3);
        const housingMesh = new THREE.Mesh(
            housing,
            new THREE.MeshPhongMaterial({ color: 0xcccccc }) // Light gray
        );
        
        // Add blue accent edges
        const edges = new THREE.BoxGeometry(2.1, 1.3, 0.1);
        const edgeMesh = new THREE.Mesh(
            edges,
            new THREE.MeshPhongMaterial({ color: 0x4a9eff }) // Light blue
        );
        edgeMesh.position.z = 0.2;
        
        // Add yoke
        const yoke = new THREE.Group();
        const yokeArm = new THREE.BoxGeometry(0.1, 1.8, 0.1);
        const leftArm = new THREE.Mesh(
            yokeArm,
            new THREE.MeshPhongMaterial({ color: 0x333333 })
        );
        leftArm.position.x = -1.1;
        const rightArm = leftArm.clone();
        rightArm.position.x = 1.1;
        yoke.add(leftArm, rightArm);
        
        group.add(housingMesh, edgeMesh, yoke);
    } 
    else if (fixture.includes('M18') || fixture.includes('T2')) {
        // Create Fresnel-style housing
        const housing = new THREE.CylinderGeometry(0.8, 1, 1.5, 8);
        const housingMesh = new THREE.Mesh(
            housing,
            new THREE.MeshPhongMaterial({ color: 0x666666 })
        );
        
        // Add lens
        const lens = new THREE.CircleGeometry(0.7, 16);
        const lensMesh = new THREE.Mesh(
            lens,
            new THREE.MeshPhongMaterial({ 
                color: 0x88ccff,
                transparent: true,
                opacity: 0.5
            })
        );
        lensMesh.position.z = 0.76;
        lensMesh.rotation.x = -Math.PI / 2;
        
        // Add yoke
        const yoke = new THREE.Group();
        const yokeArm = new THREE.BoxGeometry(0.1, 2, 0.1);
        const leftArm = new THREE.Mesh(
            yokeArm,
            new THREE.MeshPhongMaterial({ color: 0x333333 })
        );
        leftArm.position.x = -1;
        const rightArm = leftArm.clone();
        rightArm.position.x = 1;
        yoke.add(leftArm, rightArm);
        
        group.add(housingMesh, lensMesh, yoke);
    }
    
    // Add label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'light-label';
    labelDiv.textContent = fixture;
    const label = new CSS2DObject(labelDiv);
    label.position.y = 2;
    group.add(label);
    
    // Set position if provided
    if (position) {
        group.position.copy(position);
    }
    
    // Add user data for interaction
    group.userData = {
        type: 'light',
        fixture: fixture,
        specs: specs,
        isDraggable: true
    };
    
    return group;
}

// Helper function to find fixture specs with better logging
function findFixtureSpecs(fixtureName) {
    console.log('Looking for specs for:', fixtureName);
    
    // Search through equipment database for matching fixture
    for (const category of Object.values(lightingEquipment)) {
        for (const brand of Object.values(category)) {
            const fixture = brand.find(f => f.name === fixtureName);
            if (fixture) {
                console.log('Found fixture specs:', fixture);
                return fixture;
            }
        }
    }
    
    console.log('No specs found for:', fixtureName);
    return null;
}

function calculateFixtureScale(dimensions, roomDimensions) {
    // Scale fixture based on room size (1 unit = 1 foot)
    const roomScale = Math.min(roomDimensions.width, roomDimensions.length) / 20; // Base scale on room size
    return roomScale * 0.0833; // Convert inches to feet
}

function calculateLightIntensity(output) {
    // Convert real-world footcandles to Three.js intensity
    // This is a simplified conversion - would need real-world testing to perfect
    return (output.fc / 1000) * Math.pow(output.distance, 2);
}

// Enhanced room analysis
function analyzeRoomSetup(description) {
    const analysis = {
        dimensions: { width: 0, length: 0, height: 12 }, // Default height 12 feet
        fixtures: []
    };
    
    // Parse dimensions
    const dimensionMatch = description.match(/(\d+)x(\d+)/);
    if (dimensionMatch) {
        analysis.dimensions.width = parseInt(dimensionMatch[1]);
        analysis.dimensions.length = parseInt(dimensionMatch[2]);
        
        // Adjust height based on room size
        if (analysis.dimensions.width >= 30 || analysis.dimensions.length >= 30) {
            analysis.dimensions.height = 16; // Higher ceiling for larger rooms
        }
    }
    
    // Parse fixture requests
    const fixtures = {
        'arri s60': 'SkyPanel S60-C',
        'm18': 'M18',
        '600d': '600D Pro',
        'skypanel': 'SkyPanel S360-C'
        // Add more fixture mappings
    };
    
    // Look for fixture mentions in description
    for (const [keyword, fixtureName] of Object.entries(fixtures)) {
        if (description.toLowerCase().includes(keyword)) {
            analysis.fixtures.push({
                name: fixtureName,
                specs: findFixtureSpecs(fixtureName)
            });
        }
    }
    
    return analysis;
}

// Clear existing lights
function clearLights() {
    lights.forEach(light => scene.remove(light));
    lights = [];
}

// Handle window resize
function onWindowResize() {
    const container = document.getElementById('diagramContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    
    // Update camera
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    
    // Update renderers
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    labelRenderer.setSize(width, height);
}

// Event listeners
window.addEventListener('resize', onWindowResize, false);

// Add gear recommendation panel
function createGearPanel() {
    const panel = document.createElement('div');
    panel.id = 'gearPanel';
    panel.className = 'gear-panel';
    panel.style.cssText = `
        position: absolute;
        right: 20px;
        top: 20px;
        width: 300px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
    `;
    document.body.appendChild(panel);
    return panel;
}

// Update gear recommendations based on description
function updateGearRecommendations(description) {
    const panel = document.getElementById('gearPanel') || createGearPanel();
    panel.innerHTML = '<h3>Recommended Equipment:</h3>';

    // Parse the description for key terms
    const terms = description.toLowerCase().split(' ');
    let recommendations = [];

    // Check for specific lighting needs
    if (description.includes('skypanel')) {
        const skyPanelInfo = {
            name: 'ARRI SkyPanel S60-C',
            specs: 'Variable CCT 2800K-10000K, RGBW',
            accessories: [
                'Chimera Lightbank',
                'Honeycomb Grid',
                'Barndoors'
            ],
            power: '450W LED (1.2K Tungsten equivalent)',
            notes: 'Ideal for soft, even illumination. Consider the S360-C for larger spaces.'
        };
        recommendations.push(skyPanelInfo);
    }

    // Check for grip equipment
    if (description.includes('ultrabounce')) {
        const bounceInfo = {
            name: '8x8 Ultra Bounce',
            specs: 'Double-sided White/Black',
            rigging: [
                '2x C-Stands with Grip Heads',
                'Sand Bags',
                'Safety Cables'
            ],
            notes: 'Position 45° to source for optimal reflection. Consider Matthews RoadRags Kit for mobility.'
        };
        recommendations.push(bounceInfo);
    }

    // Display recommendations
    recommendations.forEach(item => {
        const itemHtml = `
            <div class="gear-item" style="margin: 10px 0; padding: 10px; border: 1px solid #444;">
                <h4 style="margin: 0 0 8px 0;">${item.name}</h4>
                ${item.specs ? `<p style="margin: 4px 0;">Specs: ${item.specs}</p>` : ''}
                ${item.power ? `<p style="margin: 4px 0;">Power: ${item.power}</p>` : ''}
                ${item.accessories ? `
                    <p style="margin: 4px 0;">Recommended Accessories:</p>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        ${item.accessories.map(acc => `<li>${acc}</li>`).join('')}
                    </ul>
                ` : ''}
                ${item.rigging ? `
                    <p style="margin: 4px 0;">Rigging Needs:</p>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        ${item.rigging.map(rig => `<li>${rig}</li>`).join('')}
                    </ul>
                ` : ''}
                ${item.notes ? `<p style="margin: 4px 0; font-style: italic;">Note: ${item.notes}</p>` : ''}
            </div>
        `;
        panel.innerHTML += itemHtml;
    });

    // Add general tips if relevant
    if (description.includes('table')) {
        panel.innerHTML += `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;">
                <h4>Lighting Tips:</h4>
                <ul style="padding-left: 20px;">
                    <li>Consider adding a backlight for subject separation</li>
                    <li>Use Ultra Bounce as negative fill on opposite side of key</li>
                    <li>Think about eye lights for subjects around table</li>
                </ul>
            </div>
        `;
    }
}

// Add diagnostic logging
function logDiagnostics(title, data) {
    console.log('=== ' + title + ' ===');
    console.log(data);
    console.log('==================');
}

// Add to setupDropZone function - DO NOT MODIFY EXISTING CODE
function setupDropZone() {
    const container = document.getElementById('diagramContainer');
    
    // Add diagnostic check
    logDiagnostics('Container Check', {
        containerFound: !!container,
        containerDimensions: container ? {
            width: container.clientWidth,
            height: container.clientHeight
        } : null
    });
    
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const itemName = e.dataTransfer.getData('text/plain');
        
        // Add diagnostic logging
        logDiagnostics('Drop Event', {
            itemName: itemName,
            mousePosition: {
                clientX: e.clientX,
                clientY: e.clientY
            },
            containerBounds: container.getBoundingClientRect()
        });
        
        // Get drop coordinates in 3D space
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        logDiagnostics('3D Coordinates', {
            normalized: { x, y },
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            }
        });
        
        // Create raycaster for accurate placement
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        
        // Find intersection with floor
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        const didIntersect = raycaster.ray.intersectPlane(floorPlane, intersection);
        
        logDiagnostics('Intersection Check', {
            intersectionFound: !!didIntersect,
            intersectionPoint: didIntersect ? {
                x: intersection.x,
                y: intersection.y,
                z: intersection.z
            } : null,
            cameraPosition: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            sceneChildren: scene.children.length
        });
        
        if (didIntersect) {
            console.log('Drop position:', intersection);
            addEquipmentToScene(itemName, intersection);
        }
    });
}

// Equipment data structure with comprehensive lighting gear
const equipmentData = {
    'LED Fixtures': [
        { 
            name: 'ARRI SkyPanel S360-C',
            specs: '1500W LED Panel',
            details: {
                power: '1500W',
                beam: '105° - 115°',
                color: 'RGBW, 2800K-10000K',
                dmx: '8/16-bit',
                dimensions: '55.9" x 25.3" x 7.9"'
            }
        },
        { 
            name: 'ARRI SkyPanel S60-C',
            specs: '450W LED Panel',
            details: {
                power: '450W',
                beam: '115° - 125°',
                color: 'RGBW, 2800K-10000K',
                dmx: '8/16-bit',
                dimensions: '25.4" x 11.8" x 6.7"'
            }
        },
        {
            name: 'Aputure 600D Pro',
            specs: '600W LED Fresnel',
            details: {
                power: '600W',
                beam: '15° - 45°',
                color: '5600K',
                dmx: 'Yes',
                dimensions: '12.8" x 10.2" x 7.1"'
            }
        }
    ],
    'HMI Fixtures': [
        {
            name: 'ARRI M18',
            specs: '1800W HMI Fresnel',
            details: {
                power: '1800W',
                beam: '12° - 50°',
                color: '5600K',
                ballast: 'Electronic',
                dimensions: '22.8" x 18.9" x 14.2"'
            }
        },
        {
            name: 'ARRI M90',
            specs: '9000W HMI Fresnel',
            details: {
                power: '9000W',
                beam: '8° - 55°',
                color: '5600K',
                ballast: 'Electronic',
                dimensions: '31.5" x 27.6" x 19.7"'
            }
        }
    ],
    'Tungsten': [
        {
            name: 'ARRI T12',
            specs: '12000W Fresnel',
            details: {
                power: '12000W',
                beam: '10° - 60°',
                color: '3200K',
                dimming: '100-0%',
                dimensions: '34" x 30" x 22"'
            }
        },
        {
            name: 'ARRI T2',
            specs: '2000W Fresnel',
            details: {
                power: '2000W',
                beam: '12° - 65°',
                color: '3200K',
                dimming: '100-0%',
                dimensions: '18" x 16" x 12"'
            }
        }
    ],
    'Grip Equipment': [
        {
            name: 'UltraBounce 12x12',
            specs: 'Reflector/Diffusion',
            details: {
                size: '12\' x 12\'',
                type: 'Double-sided White/Black',
                rigging: '4x C-Stands or Frame',
                weight: '12 lbs'
            }
        },
        {
            name: 'UltraBounce 8x8',
            specs: 'Reflector/Diffusion',
            details: {
                size: '8\' x 8\'',
                type: 'Double-sided White/Black',
                rigging: '2x C-Stands or Frame',
                weight: '8 lbs'
            }
        },
        {
            name: 'Flag Kit 24x36',
            specs: 'Negative Fill/Cutter',
            details: {
                size: '24" x 36"',
                type: 'Solid Black',
                rigging: 'C-Stand',
                includes: 'Flags, Nets, Silks'
            }
        },
        {
            name: 'C-Stand Kit',
            specs: 'Support Equipment',
            details: {
                height: '10.5\'',
                base: '40" Turtle Base',
                grip: '40" Grip Arm',
                weight: '15 lbs'
            }
        }
    ],
    'Overhead Rigs': [
        {
            name: '20x20 Frame',
            specs: 'Overhead Grid',
            details: {
                size: '20\' x 20\'',
                rigging: '4x 1-ton Motors',
                safety: 'Required Cables',
                certification: 'Load Test Required'
            }
        },
        {
            name: '12x12 Frame',
            specs: 'Overhead Grid',
            details: {
                size: '12\' x 12\'',
                rigging: '2x 1/2-ton Motors',
                safety: 'Required Cables',
                certification: 'Load Test Required'
            }
        }
    ]
};

function createEquipmentPanel() {
    const panel = document.getElementById('equipmentPanel');
    if (!panel) {
        console.error('Equipment panel not found');
        return;
    }
    
    // Clear existing content
    panel.innerHTML = '<h3>Equipment List</h3>';
    
    // Equipment categories and items
    const equipment = {
        'LED Fixtures': [
            {
                name: 'ARRI SkyPanel S60-C',
                specs: '450W LED Panel',
                details: { power: '450W', color: 'RGBW' }
            },
            {
                name: 'ARRI SkyPanel S360-C',
                specs: '1500W LED Panel',
                details: { power: '1500W', color: 'RGBW' }
            }
        ],
        'HMI Fixtures': [
            {
                name: 'ARRI M18',
                specs: '1800W HMI Fresnel',
                details: { power: '1800W', color: '5600K' }
            }
        ],
        'Grip Equipment': [
            {
                name: 'C-Stand',
                specs: 'Support Equipment',
                details: { height: '10.5ft', arm: '40"' }
            },
            {
                name: '8x8 UltraBounce',
                specs: 'Reflector/Diffusion',
                details: { size: '8\' x 8\'', type: 'Double-sided' }
            }
        ]
    };
    
    // Create sections for each category
    Object.entries(equipment).forEach(([category, items]) => {
        const section = document.createElement('div');
        section.className = 'equipment-section';
        
        const title = document.createElement('h4');
        title.textContent = category;
        section.appendChild(title);
        
        items.forEach(item => {
            const equipDiv = document.createElement('div');
            equipDiv.className = 'equipment-item';
            equipDiv.draggable = true;
            
            equipDiv.innerHTML = `
                <div class="name">${item.name}</div>
                <div class="specs">${item.specs}</div>
                <div class="power">${item.details.power || item.details.size || ''}</div>
            `;
            
            // Add drag functionality
            equipDiv.addEventListener('dragstart', (e) => {
                console.log('Drag started:', item.name);
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    category: category,
                    name: item.name,
                    specs: item.specs,
                    details: item.details
                }));
                equipDiv.classList.add('dragging');
            });
            
            equipDiv.addEventListener('dragend', () => {
                equipDiv.classList.remove('dragging');
            });
            
            section.appendChild(equipDiv);
        });
        
        panel.appendChild(section);
    });
    
    console.log('Equipment panel populated');
}

// Initialize equipment panel after scene setup
document.addEventListener('DOMContentLoaded', () => {
    createEquipmentPanel();
    setupDropZone();
});

// Update environment controls
function createEnvironmentSetup() {
    const setupPanel = document.createElement('div');
    setupPanel.id = 'environmentSetup';
    setupPanel.style.cssText = `
        position: absolute;
        left: 20px;
        top: 100px;
        background: rgba(0,0,0,0.7);
        padding: 15px;
        border-radius: 8px;
        color: white;
        z-index: 1;
        display: none;
    `;

    setupPanel.innerHTML = `
        <h3>Environment Dimensions</h3>
        <div style="margin: 10px 0;">
            <label>Width (ft): <input type="number" id="envWidth" value="32" min="10" max="100"></label>
        </div>
        <div style="margin: 10px 0;">
            <label>Length (ft): <input type="number" id="envLength" value="32" min="10" max="100"></label>
        </div>
        <div style="margin: 10px 0;">
            <label>Height (ft): <input type="number" id="envHeight" value="20" min="8" max="40"></label>
        </div>
        <button id="lockEnvironment">Lock Environment</button>
    `;

    document.body.appendChild(setupPanel);

    // Add lock environment handler
    document.getElementById('lockEnvironment').addEventListener('click', () => {
        environmentLocked = true;
        currentEnvironmentDimensions = {
            width: parseInt(document.getElementById('envWidth').value),
            length: parseInt(document.getElementById('envLength').value),
            height: parseInt(document.getElementById('envHeight').value)
        };
        
        // Hide setup panel
        setupPanel.style.display = 'none';
        
        // Show equipment panel
        document.getElementById('equipmentPanel').style.display = 'block';
        
        // Update environment with new dimensions
        updateEnvironmentDimensions();
        
        console.log('Environment locked with dimensions:', currentEnvironmentDimensions);
    });
}

// Function to update environment with new dimensions
function updateEnvironmentDimensions() {
    if (!room) return;
    
    // Update room geometry
    room.children.forEach(child => {
        if (child.geometry) {
            // Update floor
            if (child.geometry.type === 'PlaneGeometry') {
                child.geometry.dispose();
                child.geometry = new THREE.PlaneGeometry(
                    currentEnvironmentDimensions.width,
                    currentEnvironmentDimensions.length
                );
            }
            // Update walls
            else if (child.geometry.type === 'BoxGeometry') {
                child.geometry.dispose();
                child.geometry = new THREE.BoxGeometry(
                    currentEnvironmentDimensions.width,
                    currentEnvironmentDimensions.height,
                    currentEnvironmentDimensions.length
                );
            }
        }
    });
    
    // Update grid if present
    updateGrid();
}

function createEquipmentInScene(data, position) {
    const { category, name, details } = JSON.parse(data);
    let mesh;
    
    switch(category) {
        case 'LED Fixtures':
        case 'HMI Fixtures':
        case 'Tungsten':
            mesh = createLight(name, position, details);
            break;
        case 'Grip Equipment':
            if (name.includes('UltraBounce')) {
                const [width, height] = details.size.match(/\d+/g).map(Number);
                mesh = createUltrabounce(width, height);
            } else if (name.includes('Flag')) {
                const [width, height] = details.size.match(/\d+/g).map(Number);
                mesh = createNegativeFill(width/12, height/12); // Convert inches to feet
            } else if (name.includes('C-Stand')) {
                mesh = createCStand(details);
            }
            break;
        case 'Overhead Rigs':
            const [width, length] = details.size.match(/\d+/g).map(Number);
            mesh = createOverheadFrame(width, length);
            break;
    }
    
    if (mesh) {
        // Position the mesh at drop location
        mesh.position.copy(position);
        
        // Add to scene and make draggable
        scene.add(mesh);
        objects.push(mesh);
        makeObjectDraggable(mesh);
        
        // Store equipment details for later reference
        mesh.userData = {
            type: category,
            name: name,
            specs: details,
            isDraggable: true
        };
    }
}

function setupDropZone() {
    const dropZone = renderer.domElement;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        // Calculate drop position in 3D space
        const rect = dropZone.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Create raycaster for accurate placement
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        
        // Find intersection with floor plane
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(floorPlane, intersection)) {
            createEquipmentInScene(data, intersection);
        }
    });
}

// Helper function to create C-Stand
function createCStand() {
    const group = new THREE.Group();
    
    // Base - simplified to a flat disc
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16),
        new THREE.MeshPhongMaterial({ color: 0x333333 }) // Dark gray
    );
    
    // Main riser - single pole
    const riser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 4, 8),
        new THREE.MeshPhongMaterial({ color: 0x666666 }) // Medium gray
    );
    riser.position.y = 2;
    
    // Arm - simplified to a single bar
    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 0.1),
        new THREE.MeshPhongMaterial({ color: 0x666666 })
    );
    arm.position.y = 3.8;
    arm.position.x = 0.8; // Offset to one side like a C-Stand
    
    // Knob for arm
    const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x333333 })
    );
    knob.position.y = 3.8;
    
    group.add(base, riser, arm, knob);
    
    // Add label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'light-label';
    labelDiv.textContent = 'C-Stand';
    const label = new CSS2DObject(labelDiv);
    label.position.y = 4.2;
    group.add(label);
    
    // Add user data
    group.userData = {
        type: 'grip',
        name: 'C-Stand',
        isDraggable: true
    };
    
    return group;
} 

// Add checkpoint restoration function
window.restoreToStable = function() {
    try {
        StateValidator.validateOperation('restore', StateValidator.getCurrentState());
        return CoreProtection.restoreCheckpoint('STABLE_V1');
    } catch (error) {
        console.error('Failed to restore to stable version:', error);
        return AutoRecovery.handleError(error, {
            operation: 'restore_checkpoint',
            checkpoint: 'STABLE_V1'
        });
    }
};

// Add checkpoint creation function
window.createCheckpoint = function(codeword) {
    try {
        StateValidator.validateOperation('checkpoint', StateValidator.getCurrentState());
        return CoreProtection.createCheckpoint(codeword);
    } catch (error) {
        console.error('Failed to create checkpoint:', error);
        return AutoRecovery.handleError(error, {
            operation: 'create_checkpoint',
            codeword: codeword
        });
    }
};

// Add checkpoint listing function
window.listCheckpoints = function() {
    try {
        return CoreProtection.listCheckpoints();
    } catch (error) {
        console.error('Failed to list checkpoints:', error);
        return [];
    }
}; 