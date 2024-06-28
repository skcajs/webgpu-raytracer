import raytracer_kernel from "./shaders/raytracer_kernel.wgsl?raw";
import screen_shader from "./shaders/screen_shader.wgsl?raw";
import { Scene } from "./scene";

export class Renderer {
    canvas: HTMLCanvasElement;

    // Device
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;

    // Assets
    colorBuffer: GPUTexture;
    colorBufferView: GPUTextureView;
    sampler: GPUSampler;
    sceneParams: GPUBuffer;
    sphereBuffer: GPUBuffer;

    // Pipeline
    rayTracingPipeline: GPUComputePipeline;
    rayTracingBindGroup: GPUBindGroup;
    screenPipeline: GPURenderPipeline;
    screenBindGround: GPUBindGroup;

    scene: Scene

    constructor(canvas: HTMLCanvasElement, scene: Scene) {
        this.canvas = canvas;

        this.adapter = undefined!;
        this.device = undefined!;
        this.context = undefined!;
        this.format = undefined!;

        this.colorBuffer = undefined!;
        this.colorBufferView = undefined!;
        this.sampler = undefined!;
        this.sceneParams = undefined!;
        this.sphereBuffer = undefined!;

        this.rayTracingPipeline = undefined!;
        this.rayTracingBindGroup = undefined!;
        this.screenPipeline = undefined!;
        this.screenBindGround = undefined!;

        this.scene = scene;
    }

    async initialize() {

        await this.setupDevice();

        await this.createAssets();

        await this.makePipeline();

        this.render();
    }

    async setupDevice() {
        this.adapter = <GPUAdapter>await navigator.gpu?.requestAdapter();
        this.device = <GPUDevice>await this.adapter?.requestDevice();
        this.context = <GPUCanvasContext>this.canvas.getContext("webgpu");
        this.format = "bgra8unorm";
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque"
        });
    }

    async createAssets() {

        this.colorBuffer = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });

        this.colorBufferView = this.colorBuffer.createView();

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: "linear",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            maxAnisotropy: 1
        };
        this.sampler = this.device.createSampler(samplerDescriptor);

        const paramBufferDescriptor: GPUBufferDescriptor = {
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        };
        this.sceneParams = this.device.createBuffer(
            paramBufferDescriptor
        );

        const sphereBufferDescriptor: GPUBufferDescriptor = {
            size: 32 * this.scene.spheres.length,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        };
        this.sphereBuffer = this.device.createBuffer(
            sphereBufferDescriptor
        );
    }

    async makePipeline() {

        const rayTracingBindGroupLayout = this.device.createBindGroupLayout(
            {
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.COMPUTE,
                        storageTexture: {
                            access: "write-only",
                            format: "rgba8unorm",
                            viewDimension: "2d"
                        }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: {
                            type: "uniform"
                        }
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: {
                            type: "read-only-storage",
                            hasDynamicOffset: false
                        }
                    },
                ]
            }
        );

        this.rayTracingBindGroup = this.device.createBindGroup(
            {
                layout: rayTracingBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: this.colorBufferView
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.sceneParams
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.sphereBuffer
                        }
                    }
                ]
            }
        );

        const rayTracingPipelineLayout = this.device.createPipelineLayout(
            {
                bindGroupLayouts: [rayTracingBindGroupLayout]
            }
        );

        this.rayTracingPipeline = this.device.createComputePipeline(
            {
                layout: rayTracingPipelineLayout,

                compute: {
                    module: this.device.createShaderModule(
                        {
                            code: raytracer_kernel
                        }
                    ),
                    entryPoint: "main",
                }
            }
        );

        const screenBindGroupLayout = this.device.createBindGroupLayout(
            {
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler: {}
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        texture: {}
                    },
                ]
            }
        );

        this.screenBindGround = this.device.createBindGroup(
            {
                layout: screenBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: this.sampler
                    },
                    {
                        binding: 1,
                        resource: this.colorBufferView
                    },
                ]
            }
        );

        const screenPipelineLayout = this.device.createPipelineLayout(
            {
                bindGroupLayouts: [screenBindGroupLayout]
            }
        );

        this.screenPipeline = this.device.createRenderPipeline(
            {
                layout: screenPipelineLayout,

                vertex: {
                    module: this.device.createShaderModule(
                        {
                            code: screen_shader
                        }
                    ),
                    entryPoint: "vert_main",
                },

                fragment: {
                    module: this.device.createShaderModule(
                        {
                            code: screen_shader
                        }
                    ),
                    entryPoint: "frag_main",
                    targets: [
                        {
                            format: "bgra8unorm"
                        }
                    ]
                },

                primitive: {
                    topology: "triangle-list"
                }
            }
        );
    }

    prepareScene() {

        const sceneData = {
            camPos: this.scene.camera.position,
            camForward: this.scene.camera.forward,
            camRight: this.scene.camera.right,
            camUp: this.scene.camera.up,
            sphereCount: this.scene.spheres.length
        };

        this.device.queue.writeBuffer(
            this.sceneParams, 0,
            new Float32Array(
                [
                    sceneData.camPos[0],
                    sceneData.camPos[1],
                    sceneData.camPos[2],
                    0.0,
                    sceneData.camForward[0],
                    sceneData.camForward[1],
                    sceneData.camForward[2],
                    0.0,
                    sceneData.camRight[0],
                    sceneData.camRight[1],
                    sceneData.camRight[2],
                    0.0,
                    sceneData.camUp[0],
                    sceneData.camUp[1],
                    sceneData.camUp[2],
                    sceneData.sphereCount
                ]
            ), 0, 16
        );

        const sphereData: Float32Array = new Float32Array(8 * this.scene.spheres.length);
        for (let i = 0; i < this.scene.spheres.length; ++i) {
            sphereData[8 * i + 0] = this.scene.spheres[i].center[0];
            sphereData[8 * i + 1] = this.scene.spheres[i].center[1];
            sphereData[8 * i + 2] = this.scene.spheres[i].center[2];
            sphereData[8 * i + 3] = 0.0;
            sphereData[8 * i + 4] = this.scene.spheres[i].color[0];
            sphereData[8 * i + 5] = this.scene.spheres[i].color[1];
            sphereData[8 * i + 6] = this.scene.spheres[i].color[2];
            sphereData[8 * i + 7] = this.scene.spheres[i].radius;
        }

        this.device.queue.writeBuffer(this.sphereBuffer, 0, sphereData, 0, 8 * this.scene.spheres.length);
    }

    render = () => {

        this.prepareScene();

        const commandEncoder: GPUCommandEncoder = this.device.createCommandEncoder();

        const rayTracingPass: GPUComputePassEncoder = commandEncoder.beginComputePass();
        rayTracingPass.setPipeline(this.rayTracingPipeline);
        rayTracingPass.setBindGroup(0, this.rayTracingBindGroup);
        rayTracingPass.dispatchWorkgroups(this.canvas.width, this.canvas.height, 1);
        rayTracingPass.end();

        const textureView: GPUTextureView = this.context.getCurrentTexture().createView();

        const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.5, g: 0.0, b: 0.25, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderpass.setPipeline(this.screenPipeline);
        renderpass.setBindGroup(0, this.screenBindGround);
        renderpass.draw(6, 1, 0, 0);

        renderpass.end();

        this.device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(this.render);
    }
}