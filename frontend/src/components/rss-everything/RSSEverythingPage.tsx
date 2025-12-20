'use client';

import { useRSSEverything } from '@/hooks/rss-everything/useRSSEverything';
import { RSSEverythingContext } from '@/stores/tabStore';
import {
  StepHeader,
  UrlStep,
  ListSelectorStep,
  DetailSelectorStep,
  PreviewStep,
  SaveStep,
  SourceTypeStep,
  RssSaveStep,
} from '.';

interface RSSEverythingPageProps {
  context?: RSSEverythingContext;
}

export default function RSSEverythingPage({ context }: RSSEverythingPageProps) {
  const {
    // State
    currentStep,
    url,
    useBrowser,
    browserService,
    waitSelector,
    isLoading,
    error,
    parseMode,
    listHtml,
    listSelectors,
    detailHtml,
    detailUrl,
    detailSelectors,
    previewItems,
    previewLoading,
    customHeaders,
    dateFormats,
    excludeSelectors,
    isSaving,
    activeListField,
    activeDetailField,
    currentStepIndex,
    // Validation
    selectorValidation,
    isValidating,

    // Source type
    sourceType,
    handleSourceTypeSelect,

    // RSS specific
    rssValidationResult,
    handleSaveRssFeed,
    handleValidateRss,

    // Edit mode
    isEditMode,

    // Setters
    setUrl,
    setUseBrowser,
    setBrowserService,
    setWaitSelector,
    setParseMode,
    setListSelectors,
    setDetailUrl,
    setDetailSelectors,
    setCustomHeaders,
    setDateFormats,
    setExcludeSelectors,
    setActiveListField,
    setActiveDetailField,

    // Actions
    handleFetchListHTML,
    handleFetchDetailHTML,
    handleListSelectorFromViewer,
    handleDetailSelectorFromViewer,
    handleListSelectNext,
    handlePreview,
    handleSave,
    handleReset,
    goBack,
    goToSave,
    // Validation
    handleValidateSelectors,
  } = useRSSEverything({ context });

  return (
    <div className="h-full bg-background overflow-auto">
      <StepHeader
        currentStepIndex={currentStepIndex}
        sourceType={sourceType}
        onReset={handleReset}
      />

      <div className="mx-auto px-4 py-2 max-w-[1600px]">
        {error && (
          <div className="mb-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {currentStep === 'source-type' && (
          <SourceTypeStep
            onSelect={handleSourceTypeSelect}
          />
        )}

        {currentStep === 'rss-save' && (
          <RssSaveStep
            url={url}
            isSaving={isSaving}
            isEditMode={isEditMode}
            validationResult={rssValidationResult}
            onUrlChange={setUrl}
            onBack={goBack}
            onSave={handleSaveRssFeed}
          />
        )}

        {currentStep === 'url' && (
          <UrlStep
            url={url}
            useBrowser={useBrowser}
            browserService={browserService}
            waitSelector={waitSelector}
            parseMode={parseMode}
            isLoading={isLoading}
            customHeaders={customHeaders}
            onUrlChange={setUrl}
            onUseBrowserChange={setUseBrowser}
            onBrowserServiceChange={setBrowserService}
            onWaitSelectorChange={setWaitSelector}
            onParseModeChange={setParseMode}
            onCustomHeadersChange={setCustomHeaders}
            onFetch={handleFetchListHTML}
          />
        )}

        {currentStep === 'list-select' && listHtml && (
          <ListSelectorStep
            parseMode={parseMode}
            listHtml={listHtml}
            url={url}
            listSelectors={listSelectors}
            activeListField={activeListField}
            previewLoading={previewLoading}
            dateFormats={dateFormats}
            excludeSelectors={excludeSelectors}
            selectorValidation={selectorValidation}
            isValidating={isValidating}
            onValidate={handleValidateSelectors}
            onListSelectorsChange={setListSelectors}
            onActiveListFieldChange={setActiveListField}
            onSelectorFromViewer={handleListSelectorFromViewer}
            onDateFormatsChange={setDateFormats}
            onExcludeSelectorsChange={setExcludeSelectors}
            onBack={goBack}
            onNext={handleListSelectNext}
            onPreview={handlePreview}
          />
        )}

        {currentStep === 'detail-select' && (
          <DetailSelectorStep
            detailUrl={detailUrl}
            detailHtml={detailHtml}
            detailSelectors={detailSelectors}
            activeDetailField={activeDetailField}
            isLoading={isLoading}
            previewLoading={previewLoading}
            dateFormats={dateFormats}
            excludeSelectors={excludeSelectors}
            onDetailUrlChange={setDetailUrl}
            onDetailSelectorsChange={setDetailSelectors}
            onActiveDetailFieldChange={setActiveDetailField}
            onSelectorFromViewer={handleDetailSelectorFromViewer}
            onDateFormatsChange={setDateFormats}
            onExcludeSelectorsChange={setExcludeSelectors}
            onFetchDetail={handleFetchDetailHTML}
            onBack={goBack}
            onPreview={handlePreview}
          />
        )}

        {currentStep === 'preview' && (
          <PreviewStep
            previewItems={previewItems}
            onBack={goBack}
            onContinue={goToSave}
          />
        )}

        {currentStep === 'save' && (
          <SaveStep
            isSaving={isSaving}
            onBack={goBack}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
