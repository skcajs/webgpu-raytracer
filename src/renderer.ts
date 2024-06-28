import raytracer_kernel from "./shaders/raytracer_kernel.wgsl?raw";
import screen_shader from "./shaders/screen_shader.wgsl?raw";

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

    // Pipeline
    rayTracingPipeline: GPUComputePipeline;
    rayTracingBindGroup: GPUBindGroup;
    screenPipeline: GPURenderPipeline;
    screenBindGround: GPUBindGroup;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.adapter = undefined!;
        this.device = undefined!;
        this.context = undefined!;
        this.format = undefined!;

        this.colorBuffer = undefined!;
        this.colorBufferView = undefined!;
        this.sampler = undefined!;

        this.rayTracingPipeline = undefined!;
        this.rayTracingBindGroup = undefined!;
        this.screenPipeline = undefined!;
        this.screenBindGround = undefined!;
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

    render = () => {

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