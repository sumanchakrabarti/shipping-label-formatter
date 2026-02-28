import SwiftUI
import PhotosUI

struct ContentView: View {
    @StateObject private var viewModel = LabelViewModel()

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // Header
                    Text("Two 4×6 labels on one 8.5×11 landscape page")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)

                    // Two label slots side by side
                    HStack(spacing: 12) {
                        LabelDropView(
                            title: "Left Label",
                            image: viewModel.label1,
                            isProcessing: viewModel.isProcessing
                        ) {
                            viewModel.activeSlot = 0
                            viewModel.showingImportOptions = true
                        } onClear: {
                            viewModel.label1 = nil
                        }

                        LabelDropView(
                            title: "Right (Optional)",
                            image: viewModel.label2,
                            isProcessing: viewModel.isProcessing
                        ) {
                            viewModel.activeSlot = 1
                            viewModel.showingImportOptions = true
                        } onClear: {
                            viewModel.label2 = nil
                        }
                    }
                    .padding(.horizontal)

                    // Page preview
                    PagePreviewView(label1: viewModel.label1, label2: viewModel.label2)
                        .padding(.horizontal)

                    // Options
                    VStack(spacing: 12) {
                        HStack {
                            Text("Fit Mode")
                                .foregroundColor(.secondary)
                            Spacer()
                            Picker("Fit Mode", selection: $viewModel.fitMode) {
                                ForEach(FitMode.allCases) { mode in
                                    Text(mode.rawValue).tag(mode)
                                }
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 200)
                        }

                        HStack {
                            Text("Auto-Crop to Border")
                                .foregroundColor(.secondary)
                            Spacer()
                            Toggle("", isOn: $viewModel.autoCrop)
                                .labelsHidden()
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.04), radius: 2)
                    .padding(.horizontal)

                    // Generate button
                    Button(action: { viewModel.generatePDF() }) {
                        HStack {
                            if viewModel.isProcessing {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(viewModel.isProcessing ? "Processing…" : "Resize & Create PDF")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.label1 == nil ? Color.blue.opacity(0.4) : Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(viewModel.label1 == nil || viewModel.isProcessing)
                    .padding(.horizontal)

                    // Status
                    if let error = viewModel.errorMessage {
                        Text("❌ \(error)")
                            .foregroundColor(.red)
                            .font(.footnote)
                    }
                }
                .padding(.vertical)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("📦 Label Formatter")
            .navigationBarTitleDisplayMode(.inline)
            // Import options action sheet
            .confirmationDialog("Add Label", isPresented: $viewModel.showingImportOptions) {
                Button("Photo Library") { viewModel.showingPhotoPicker = true }
                Button("Choose File") { viewModel.showingFilePicker = true }
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Take Photo") { viewModel.showingCamera = true }
                }
            }
            // Photo picker
            .photosPicker(
                isPresented: $viewModel.showingPhotoPicker,
                selection: $viewModel.photoSelection,
                matching: .images
            )
            .onChange(of: viewModel.photoSelection) { _, newValue in
                viewModel.loadFromPhotoPicker(newValue)
            }
            // File picker (images + PDFs)
            .fileImporter(
                isPresented: $viewModel.showingFilePicker,
                allowedContentTypes: [.image, .pdf],
                allowsMultipleSelection: false
            ) { result in
                viewModel.loadFromFileImporter(result)
            }
            // Camera
            .fullScreenCover(isPresented: $viewModel.showingCamera) {
                CameraView { image in
                    viewModel.setImage(image)
                }
            }
            // Share sheet for generated PDF
            .sheet(isPresented: $viewModel.showingShareSheet) {
                if let pdfData = viewModel.generatedPDF {
                    ShareSheet(activityItems: [pdfData])
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}

// MARK: - Label Drop View

struct LabelDropView: View {
    let title: String
    let image: UIImage?
    let isProcessing: Bool
    let onTap: () -> Void
    let onClear: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.blue)
                .textCase(.uppercase)

            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        image != nil ? Color.green : Color.blue.opacity(0.4),
                        style: StrokeStyle(lineWidth: 2, dash: image != nil ? [] : [6])
                    )
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(image != nil ? Color.green.opacity(0.05) : Color.white)
                    )

                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .cornerRadius(8)
                        .padding(8)
                } else {
                    VStack(spacing: 4) {
                        Image(systemName: "doc.badge.plus")
                            .font(.title2)
                            .foregroundColor(.blue.opacity(0.6))
                        Text("Tap to add")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .frame(height: 140)
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)

            if image != nil {
                Button("Clear", role: .destructive, action: onClear)
                    .font(.caption2)
            }
        }
    }
}

// MARK: - Page Preview

struct PagePreviewView: View {
    let label1: UIImage?
    let label2: UIImage?

    var body: some View {
        HStack(spacing: 8) {
            slotView(label1, placeholder: "Left")
            slotView(label2, placeholder: "Right")
        }
        .padding(8)
        .aspectRatio(11.0 / 8.5, contentMode: .fit)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
    }

    @ViewBuilder
    func slotView(_ image: UIImage?, placeholder: String) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .strokeBorder(
                    image != nil ? Color.green.opacity(0.5) : Color(.systemGray4),
                    style: StrokeStyle(lineWidth: 1, dash: image != nil ? [] : [3])
                )
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(image != nil ? Color.green.opacity(0.05) : Color.clear)
                )

            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(2)
            } else {
                Text(placeholder)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
        }
        .aspectRatio(4.0 / 6.0, contentMode: .fit)
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Camera View

struct CameraView: UIViewControllerRepresentable {
    let onCapture: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        init(_ parent: CameraView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onCapture(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
