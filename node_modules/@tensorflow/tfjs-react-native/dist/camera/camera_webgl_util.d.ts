/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import { Rotation } from './types';
interface Dimensions {
    width: number;
    height: number;
    depth: number;
}
interface ProgramObjects {
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    vertices: Float32Array;
    uniformLocations: Map<string, WebGLUniformLocation>;
}
/**
 * Download data from an texture.
 *
 * @param gl
 * @param texture
 * @param dims
 */
export declare function downloadTextureData(gl: WebGL2RenderingContext, texture: WebGLTexture, dims: Dimensions): Uint8Array;
/**
 * Upload image data to a texture.
 *
 * @param imageData data to upload
 * @param gl gl context to use
 * @param dims image size
 * @param texture optional texture to upload data to. If none is passed a new
 *     texture will be returned
 */
export declare function uploadTextureData(imageData: Uint8Array, gl: WebGL2RenderingContext, dims: Dimensions, texture?: WebGLTexture): WebGLTexture;
/**
 * Render a texture to the default framebuffer (i.e. screen)
 *
 * @param gl WebGL context to use
 * @param texture texture to render
 * @param dims texture size
 */
export declare function drawTexture(gl: WebGL2RenderingContext, texture: WebGLTexture, dims: {
    width: number;
    height: number;
}, flipHorizontal: boolean, rotation: Rotation): void;
export declare function runResizeProgram(gl: WebGL2RenderingContext, inputTexture: WebGLTexture, inputDims: Dimensions, outputDims: Dimensions, alignCorners: boolean, useCustomShadersToResize: boolean, interpolation: 'nearest_neighbor' | 'bilinear', rotation: Rotation): WebGLTexture;
export declare function drawTextureProgram(gl: WebGL2RenderingContext, flipHorizontal: boolean, flipVertical: boolean, rotation: Rotation): ProgramObjects;
export {};
